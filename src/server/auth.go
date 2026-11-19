package main

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// mediaAudience must match AUDIENCE in src/backend/apps/rooms/media.py. It
// stops a Django login token from being used here, and the other way round.
const mediaAudience = "interlude-media"

// Claims is what Django puts in a media token: who you are and which room you joined.
type Claims struct {
	Name                 string `json:"name"` // username, shown in the listener list
	Room                 int    `json:"room"` // Django room id
	jwt.RegisteredClaims        // sub (user id), aud, iat, exp
}

// Auth checks media tokens signed with the secret Django shares with us.
// A nil secret means dev mode: no checks, anyone can join any room.
type Auth struct {
	secret []byte
}

// Verify checks the token's signature, algorithm, audience and expiry.
func (a *Auth) Verify(token string) (*Claims, error) {
	c := &Claims{}
	_, err := jwt.ParseWithClaims(token, c,
		func(*jwt.Token) (any, error) { return a.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), // never "none", never a different algorithm
		jwt.WithAudience(mediaAudience),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(5*time.Second), // small clock differences between the two servers
	)
	if err != nil {
		return nil, err
	}
	if c.Room == 0 || c.Subject == "" {
		return nil, errors.New("token has no room or user")
	}
	return c, nil
}

// check returns who is making the request, or the HTTP status to refuse it with.
func (a *Auth) check(req *http.Request, room int) (*Claims, int) {
	if a.secret == nil {
		return &Claims{Name: "guest", Room: room}, 0
	}
	token, ok := strings.CutPrefix(req.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return nil, http.StatusUnauthorized
	}
	who, err := a.Verify(token)
	if err != nil {
		return nil, http.StatusUnauthorized
	}
	if who.Room != room {
		return nil, http.StatusForbidden // a valid token, but for another room
	}
	return who, 0
}
