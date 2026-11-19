package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/pion/webrtc/v4/pkg/media"
	"github.com/pion/webrtc/v4/pkg/media/oggreader"
)

// Play starts streaming from the current position. Does nothing if already playing.
func (r *Room) Play() {
	r.control.Lock()
	defer r.control.Unlock()

	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.playing {
		r.startLocked(r.position)
	}
}

// Pause stops the stream and keeps the position.
func (r *Room) Pause() {
	r.control.Lock()
	defer r.control.Unlock()
	r.stopStream()
}

// Seek moves to a new position; playback continues if it was playing.
func (r *Room) Seek(to time.Duration) {
	r.control.Lock()
	defer r.control.Unlock()

	to = max(0, min(to, r.duration))
	wasPlaying := r.stopStream()

	r.mu.Lock()
	defer r.mu.Unlock()
	r.position = to
	if wasPlaying {
		r.startLocked(to)
	}
}

// stopStream stops the running stream and waits for it to exit.
// Returns whether something was playing. Caller holds r.control.
func (r *Room) stopStream() bool {
	r.mu.Lock()
	if !r.playing {
		r.mu.Unlock()
		return false
	}
	r.playing = false
	stop, done := r.stop, r.done
	r.mu.Unlock()

	stop() // kills ffmpeg
	<-done // the stream goroutine updates r.position, so wait without holding r.mu
	return true
}

// startLocked launches the stream goroutine. Caller holds r.mu.
func (r *Room) startLocked(from time.Duration) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	r.playing, r.stop, r.done = true, cancel, done
	go func() {
		defer close(done)
		r.stream(ctx, from)
	}()
}

// stream runs ffmpeg to turn the track into 20 ms Opus frames starting at
// `from`, and writes them to the shared track in real time.
func (r *Room) stream(ctx context.Context, from time.Duration) {
	cmd := exec.CommandContext(ctx, "ffmpeg", "-hide_banner", "-loglevel", "error",
		"-ss", fmt.Sprintf("%.3f", from.Seconds()), "-i", r.trackPath,
		"-vn", "-ac", "2", "-ar", "48000",
		"-c:a", "libopus", "-b:a", "128k", "-application", "audio", "-frame_duration", "20",
		"-page_duration", "20000", // one Opus frame per Ogg page
		"-f", "ogg", "pipe:1")
	cmd.Stderr = os.Stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("ffmpeg: %v", err)
		return
	}
	if err := cmd.Start(); err != nil {
		log.Printf("ffmpeg: %v", err)
		return
	}
	defer cmd.Wait() //nolint:errcheck // exit status after a kill is expected

	ogg, _, err := oggreader.NewWith(stdout) // also reads the OpusHead header page
	if err != nil {
		log.Printf("reading ffmpeg output: %v", err)
		return
	}

	start := time.Now()
	var sent time.Duration // audio sent so far
	var lastGranule uint64 // Ogg granule = samples so far, at 48 kHz

	for {
		page, header, err := ogg.ParseNextPage()
		if err != nil {
			break // end of track, or ffmpeg was killed by Pause/Seek
		}
		if bytes.HasPrefix(page, []byte("OpusTags")) {
			continue // metadata page, not audio
		}
		frame := time.Duration(header.GranulePosition-lastGranule) * time.Second / 48000
		lastGranule = header.GranulePosition

		// Pace by the wall clock: never send audio earlier than it should play.
		if wait := time.Until(start.Add(sent)); wait > 0 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(wait):
			}
		}
		if err := r.track.WriteSample(media.Sample{Data: page, Duration: frame}); err != nil {
			log.Printf("write sample: %v", err)
		}
		sent += frame

		r.mu.Lock()
		r.position = from + sent
		r.mu.Unlock()
	}

	if ctx.Err() == nil { // reached the end on its own, not stopped by the host
		log.Printf("track finished")
		r.mu.Lock()
		r.playing = false
		r.position = 0
		r.mu.Unlock()
	}
}
