package main

import (
	"net/http"
	"strings"
)

// withCORS lets pages from the given origins (the Django site) call the room
// routes from the browser. Tokens go in a header, not cookies, so no
// credentials mode is needed. Requests from other origins pass through
// without CORS headers, so browsers block them.
func withCORS(origins []string, next http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range origins {
		allowed[o] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		h := w.Header()
		h.Add("Vary", "Origin")
		if origin := req.Header.Get("Origin"); allowed[origin] {
			h.Set("Access-Control-Allow-Origin", origin)
			// Preflight: the browser asks whether it may send POST with our headers.
			if req.Method == http.MethodOptions && req.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET, POST")
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				h.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, req)
	})
}

// parseOrigins splits MEDIA_ALLOWED_ORIGINS ("http://localhost:8000,https://...").
func parseOrigins(s string) []string {
	var out []string
	for _, o := range strings.Split(s, ",") {
		if o = strings.TrimRight(strings.TrimSpace(o), "/"); o != "" {
			out = append(out, o)
		}
	}
	return out
}
