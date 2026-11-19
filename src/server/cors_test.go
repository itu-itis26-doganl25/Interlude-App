package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// The room page is served by Django (another origin), so browsers ask before
// sending the token header. Only the Django site's origin may call us.
func TestCORSAllowsOnlyTheDjangoSite(t *testing.T) {
	h := withCORS([]string{"https://interlude.example"}, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot) // stands in for the real routes
	}))
	do := func(method, origin string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/rooms/1/offer", nil)
		req.Header.Set("Origin", origin)
		if method == http.MethodOptions {
			req.Header.Set("Access-Control-Request-Method", "POST")
			req.Header.Set("Access-Control-Request-Headers", "authorization, content-type")
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}

	pre := do(http.MethodOptions, "https://interlude.example")
	if pre.Code != http.StatusNoContent {
		t.Errorf("preflight status %d, want 204", pre.Code)
	}
	if got := pre.Header().Get("Access-Control-Allow-Origin"); got != "https://interlude.example" {
		t.Errorf("preflight allow-origin %q", got)
	}
	if got := pre.Header().Get("Access-Control-Allow-Headers"); got != "Authorization, Content-Type" {
		t.Errorf("preflight allow-headers %q", got)
	}

	post := do(http.MethodPost, "https://interlude.example")
	if post.Code != http.StatusTeapot || post.Header().Get("Access-Control-Allow-Origin") == "" {
		t.Errorf("allowed POST: status %d, allow-origin %q; want passed through with the header",
			post.Code, post.Header().Get("Access-Control-Allow-Origin"))
	}

	for _, method := range []string{http.MethodOptions, http.MethodPost} {
		if got := do(method, "https://evil.example").Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("%s from another site got allow-origin %q", method, got)
		}
	}
}

func TestParseOrigins(t *testing.T) {
	got := parseOrigins(" http://localhost:8000, https://interlude.example/ ,,")
	if len(got) != 2 || got[0] != "http://localhost:8000" || got[1] != "https://interlude.example" {
		t.Errorf("parseOrigins = %q", got)
	}
}
