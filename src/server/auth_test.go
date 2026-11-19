package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-media-secret-that-is-long-enough-for-hs256"

// djangoToken was signed by PyJWT the way apps/rooms/media.py signs tokens
// (user 7 "ayse", room 3, expires in 2100), so both sides agree on the format.
const djangoToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3IiwibmFtZSI6ImF5c2UiLCJyb29tIjozLCJhdWQiOiJpbnRlcmx1ZGUtbWVkaWEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6NDEwMjQ0NDgwMH0.CCq5Ow1Mj6H2BdHfZDCtC_s9qSiMHRDwkZ41URrIlT8"

func claimsFor(room int) jwt.MapClaims {
	now := time.Now()
	return jwt.MapClaims{
		"sub": "7", "name": "ayse", "room": room, "aud": mediaAudience,
		"iat": now.Unix(), "exp": now.Add(2 * time.Minute).Unix(),
	}
}

func sign(t *testing.T, secret string, claims jwt.MapClaims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestVerifyAcceptsDjangoToken(t *testing.T) {
	who, err := (&Auth{secret: []byte(testSecret)}).Verify(djangoToken)
	if err != nil {
		t.Fatal(err)
	}
	if who.Room != 3 || who.Subject != "7" || who.Name != "ayse" {
		t.Errorf("claims = room %d, user %q %q; want room 3, user 7 ayse", who.Room, who.Subject, who.Name)
	}
}

func TestVerifyRejectsBadTokens(t *testing.T) {
	without := func(key string) jwt.MapClaims { c := claimsFor(1); delete(c, key); return c }
	with := func(key string, v any) jwt.MapClaims { c := claimsFor(1); c[key] = v; return c }
	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, claimsFor(1)).SignedString(jwt.UnsafeAllowNoneSignatureType)
	hs512, _ := jwt.NewWithClaims(jwt.SigningMethodHS512, claimsFor(1)).SignedString([]byte(testSecret))

	tests := map[string]string{
		"garbage":             "not-a-token",
		"wrong secret":        sign(t, "some-other-secret-that-is-long-enough-too!!", claimsFor(1)),
		"expired":             sign(t, testSecret, with("exp", time.Now().Add(-time.Minute).Unix())),
		"no expiry":           sign(t, testSecret, without("exp")),
		"login token (aud)":   sign(t, testSecret, without("aud")),
		"other audience":      sign(t, testSecret, with("aud", "interlude-api")),
		"no room":             sign(t, testSecret, without("room")),
		"no user":             sign(t, testSecret, without("sub")),
		"unsigned (alg=none)": none,
		"other algorithm":     hs512,
	}
	auth := &Auth{secret: []byte(testSecret)}
	for name, token := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := auth.Verify(token); err == nil {
				t.Error("accepted, want rejected")
			}
		})
	}
}

// The HTTP checks run before any room is created, so these need no ffmpeg.
func TestRoomRoutesNeedATokenForThatRoom(t *testing.T) {
	srv := httptest.NewServer(newMux(&Rooms{rooms: map[int]*roomEntry{}}, &Auth{secret: []byte(testSecret)}))
	defer srv.Close()

	tests := []struct {
		name, method, path, token string
		want                      int
	}{
		{"offer without token", "POST", "/rooms/1/offer", "", http.StatusUnauthorized},
		{"offer with bad token", "POST", "/rooms/1/offer", "nope", http.StatusUnauthorized},
		{"offer with another room's token", "POST", "/rooms/1/offer", sign(t, testSecret, claimsFor(2)), http.StatusForbidden},
		{"control without token", "POST", "/rooms/1/control", "", http.StatusUnauthorized},
		{"state without token", "GET", "/rooms/1/state", "", http.StatusUnauthorized},
		{"room id is not a number", "POST", "/rooms/abc/offer", sign(t, testSecret, claimsFor(1)), http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest(tt.method, srv.URL+tt.path, strings.NewReader("{}"))
			if tt.token != "" {
				req.Header.Set("Authorization", "Bearer "+tt.token)
			}
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			res.Body.Close()
			if res.StatusCode != tt.want {
				t.Errorf("status %d, want %d", res.StatusCode, tt.want)
			}
		})
	}
}
