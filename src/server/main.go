// Interlude media server (WBS-11.1 spike, grown in WBS-9.1 / 11.2): streams one room's audio to
// every connected browser over WebRTC. Single room, no auth yet.
//
//	go run .                          # streams a generated beep track
//	go run . -track ~/Music/song.mp3  # streams any file ffmpeg can read
package main

import (
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
	"time"
)

//go:embed web
var webFiles embed.FS

const defaultTrack = "testdata/beeps.flac"

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	track := flag.String("track", defaultTrack, "audio file to stream (any format ffmpeg reads)")
	flag.Parse()

	if *track == defaultTrack {
		if err := ensureBeepTrack(defaultTrack); err != nil {
			log.Fatalf("creating test track: %v", err)
		}
	}

	room, err := NewRoom(*track)
	if err != nil {
		log.Fatal(err)
	}
	go room.BroadcastState(500 * time.Millisecond)

	printURLs(*addr)
	log.Fatal(http.ListenAndServe(*addr, newMux(room)))
}

// newMux wires the HTTP routes: test pages, WebRTC handshake, host commands, state.
func newMux(room *Room) *http.ServeMux {
	static, _ := fs.Sub(webFiles, "web")
	mux := http.NewServeMux()
	mux.Handle("GET /", http.FileServerFS(static))
	mux.HandleFunc("POST /offer", room.HandleOffer)
	mux.HandleFunc("POST /control", room.HandleControl)
	mux.HandleFunc("GET /state", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, room.State())
	})
	return mux
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
	fmt.Printf("\nListener: http://localhost:%s/\nHost:     http://localhost:%s/host.html\n", port, port)
	ifaces, _ := net.InterfaceAddrs()
	for _, a := range ifaces {
		if ipnet, ok := a.(*net.IPNet); ok && ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
			fmt.Printf("Other devices on your network: http://%s:%s/\n", ipnet.IP, port)
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
