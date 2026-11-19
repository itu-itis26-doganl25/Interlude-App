// Interlude media server (WBS-11.1 spike, grown in WBS-9.1 / 11.2): streams each
// listening room's audio to its participants over WebRTC. Django issues the
// media token a listener needs to join (apps/rooms/media.py).
//
//	MEDIA_SERVER_SECRET=... go run .      # checks tokens with the secret Django uses
//	MEDIA_ALLOWED_ORIGINS=http://localhost:8000  # Django site that may call us from the browser
//	go run . -dev                         # local testing: no tokens, anyone joins any room
//	go run . -dev -track ~/Music/song.mp3 # streams any file ffmpeg can read
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
)

//go:embed web
var webFiles embed.FS

const defaultTrack = "testdata/beeps.flac"

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	track := flag.String("track", defaultTrack, "audio file to stream (any format ffmpeg reads)")
	dev := flag.Bool("dev", false, "skip token checks (local testing only: anyone can join any room)")
	flag.Parse()

	auth := &Auth{}
	switch secret := os.Getenv("MEDIA_SERVER_SECRET"); {
	case secret != "":
		if len(secret) < 32 {
			log.Fatal("MEDIA_SERVER_SECRET is too short: use at least 32 characters")
		}
		auth.secret = []byte(secret)
	case *dev:
		log.Print("dev mode: tokens are not checked")
	default:
		log.Fatal("set MEDIA_SERVER_SECRET (the same value as Django's), or pass -dev for local testing")
	}

	if *track == defaultTrack {
		if err := ensureBeepTrack(defaultTrack); err != nil {
			log.Fatalf("creating test track: %v", err)
		}
	}

	rooms, err := NewRooms(*track)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("track: %s (%s)", filepath.Base(*track), rooms.duration.Round(time.Second))
	go rooms.Run(context.Background(), 500*time.Millisecond, time.Minute)

	// Origins whose pages may call us from the browser: the Django site.
	origins := parseOrigins(os.Getenv("MEDIA_ALLOWED_ORIGINS"))

	printURLs(*addr)
	log.Fatal(http.ListenAndServe(*addr, withCORS(origins, newMux(rooms, auth))))
}

// newMux wires the HTTP routes: test pages, and per room the WebRTC handshake,
// host commands and state. Every room route needs a media token for that room.
func newMux(rooms *Rooms, auth *Auth) *http.ServeMux {
	s := &server{rooms: rooms, auth: auth}
	static, _ := fs.Sub(webFiles, "web")
	mux := http.NewServeMux()
	mux.Handle("GET /", http.FileServerFS(static))
	mux.HandleFunc("POST /rooms/{room}/offer", func(w http.ResponseWriter, req *http.Request) {
		if room, who := s.enter(w, req); room != nil {
			room.HandleOffer(w, req, who)
		}
	})
	// Any participant can control playback for now; host-only is FR-34 (WBS-11.2).
	mux.HandleFunc("POST /rooms/{room}/control", func(w http.ResponseWriter, req *http.Request) {
		if room, _ := s.enter(w, req); room != nil {
			room.HandleControl(w, req)
		}
	})
	mux.HandleFunc("GET /rooms/{room}/state", func(w http.ResponseWriter, req *http.Request) {
		if room, _ := s.enter(w, req); room != nil {
			writeJSON(w, room.State())
		}
	})
	return mux
}

type server struct {
	rooms *Rooms
	auth  *Auth
}

// enter checks the request's token against the room in the URL and returns
// that room. On failure it writes the error response and returns nil.
func (s *server) enter(w http.ResponseWriter, req *http.Request) (*Room, *Claims) {
	id, err := strconv.Atoi(req.PathValue("room"))
	if err != nil || id <= 0 {
		http.NotFound(w, req)
		return nil, nil
	}
	who, status := s.auth.check(req, id)
	if status != 0 {
		if status == http.StatusUnauthorized {
			w.Header().Set("WWW-Authenticate", `Bearer realm="interlude-media"`)
		}
		http.Error(w, http.StatusText(status), status)
		return nil, nil
	}
	room, err := s.rooms.Get(id)
	if err != nil {
		log.Printf("room %d: %v", id, err)
		http.Error(w, "could not open room", http.StatusInternalServerError)
		return nil, nil
	}
	return room, who
}

// ensureBeepTrack generates a 5-minute test track: a short beep every second,
// higher-pitched every 10th second, so you can hear whether listeners line up.
func ensureBeepTrack(path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	log.Printf("generating %s ...", path)
	expr := "aevalsrc='if(lt(mod(t,1),0.06), 0.6*sin(2*PI*if(lt(mod(t,10),1),1760,880)*t), 0)':s=48000:d=300"
	cmd := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error",
		"-f", "lavfi", "-i", expr, "-ac", "2", path)
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func printURLs(addr string) {
	_, port, _ := net.SplitHostPort(addr)
	fmt.Printf("\nListener: http://localhost:%s/?room=1\nHost:     http://localhost:%s/host.html?room=1\n", port, port)
	ifaces, _ := net.InterfaceAddrs()
	for _, a := range ifaces {
		if ipnet, ok := a.(*net.IPNet); ok && ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
			fmt.Printf("Other devices on your network: http://%s:%s/?room=1\n", ipnet.IP, port)
		}
	}
	fmt.Println()
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil && !errors.Is(err, net.ErrClosed) {
		log.Printf("writing response: %v", err)
	}
}
