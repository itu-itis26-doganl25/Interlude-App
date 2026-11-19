package main

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// newTestRoom creates a room streaming a generated tone of the given length.
// Skips the test when ffmpeg isn't installed.
func newTestRoom(t *testing.T, length time.Duration) *Room {
	t.Helper()
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	path := filepath.Join(t.TempDir(), "tone.flac")
	src := fmt.Sprintf("sine=frequency=440:duration=%g", length.Seconds())
	if out, err := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error",
		"-f", "lavfi", "-i", src, "-ac", "2", path).CombinedOutput(); err != nil {
		t.Fatalf("generating tone: %v\n%s", err, out)
	}
	r, err := NewRoom(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(r.Pause)
	return r
}

func TestPlayPauseSeek(t *testing.T) {
	r := newTestRoom(t, 10*time.Second)

	r.Play()
	time.Sleep(400 * time.Millisecond)
	s := r.State()
	if !s.Playing || s.Position < 0.2 {
		t.Fatalf("after play: playing=%v position=%.2fs, want playing and > 0.2s", s.Playing, s.Position)
	}

	r.Pause()
	paused := r.State()
	time.Sleep(200 * time.Millisecond)
	if s := r.State(); s.Playing || s.Position != paused.Position {
		t.Fatalf("after pause: playing=%v position %.2fs -> %.2fs, want stopped and unchanged",
			s.Playing, paused.Position, s.Position)
	}

	r.Seek(5 * time.Second)
	if s := r.State(); s.Playing || s.Position != 5 {
		t.Fatalf("seek while paused: playing=%v position=%.2fs, want paused at 5s", s.Playing, s.Position)
	}

	r.Play()
	time.Sleep(300 * time.Millisecond)
	if s := r.State(); !s.Playing || s.Position <= 5 {
		t.Fatalf("play after seek: playing=%v position=%.2fs, want playing past 5s", s.Playing, s.Position)
	}

	r.Seek(2 * time.Second) // seek while playing restarts from the new position
	time.Sleep(300 * time.Millisecond)
	if s := r.State(); !s.Playing || s.Position < 2 || s.Position > 3 {
		t.Fatalf("seek while playing: playing=%v position=%.2fs, want playing between 2s and 3s", s.Playing, s.Position)
	}
}

func TestSeekIsClampedToTrack(t *testing.T) {
	r := newTestRoom(t, 3*time.Second)

	r.Seek(-5 * time.Second)
	if p := r.State().Position; p != 0 {
		t.Errorf("seek before start: position %.2fs, want 0", p)
	}
	r.Seek(time.Hour)
	if p, d := r.State().Position, r.State().Duration; p != d {
		t.Errorf("seek past end: position %.2fs, want %.2fs", p, d)
	}
}

func TestTrackEndStopsAndRewinds(t *testing.T) {
	r := newTestRoom(t, 3*time.Second)

	r.Seek(2500 * time.Millisecond)
	r.Play()
	deadline := time.Now().Add(3 * time.Second)
	for r.State().Playing {
		if time.Now().After(deadline) {
			t.Fatal("track did not finish")
		}
		time.Sleep(20 * time.Millisecond)
	}
	if p := r.State().Position; p != 0 {
		t.Errorf("after end: position %.2fs, want 0 (waiting for the host)", p)
	}
}
