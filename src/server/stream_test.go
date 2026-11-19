package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"
)

// testListener is a Go WebRTC client that joins the room like a browser does.
type testListener struct {
	pc      *webrtc.PeerConnection
	packets atomic.Int64 // RTP audio packets received
	state   chan State   // playback state pushed over the data channel
}

func joinRoom(t *testing.T, serverURL string) *testListener {
	t.Helper()
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pc.Close() })

	l := &testListener{pc: pc, state: make(chan State, 16)}
	if _, err := pc.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio,
		webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
		t.Fatal(err)
	}
	pc.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		if track.Codec().MimeType != webrtc.MimeTypeOpus {
			t.Errorf("codec = %s, want Opus", track.Codec().MimeType)
		}
		for {
			if _, _, err := track.ReadRTP(); err != nil {
				return
			}
			l.packets.Add(1)
		}
	})
	dc, err := pc.CreateDataChannel("state", nil)
	if err != nil {
		t.Fatal(err)
	}
	dc.OnMessage(func(msg webrtc.DataChannelMessage) {
		var s State
		if json.Unmarshal(msg.Data, &s) == nil {
			select {
			case l.state <- s:
			default: // test isn't reading; drop
			}
		}
	})

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gathered := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatal(err)
	}
	<-gathered

	body, _ := json.Marshal(pc.LocalDescription())
	res, err := http.Post(serverURL+"/offer", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("POST /offer: status %d", res.StatusCode)
	}
	var answer webrtc.SessionDescription
	if err := json.NewDecoder(res.Body).Decode(&answer); err != nil {
		t.Fatal(err)
	}
	if err := pc.SetRemoteDescription(answer); err != nil {
		t.Fatal(err)
	}
	return l
}

// waitForPackets waits until the listener has received at least n audio packets.
func (l *testListener) waitForPackets(t *testing.T, n int64, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for l.packets.Load() < n {
		if time.Now().After(deadline) {
			t.Fatalf("received %d audio packets, want at least %d", l.packets.Load(), n)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// TestListenersReceiveRoomAudio covers FR-32 (audio over WebRTC, everyone
// follows the host) and FR-33 (a late joiner gets the current audio).
func TestListenersReceiveRoomAudio(t *testing.T) {
	room := newTestRoom(t, 10*time.Second)
	go room.BroadcastState(100 * time.Millisecond)
	srv := httptest.NewServer(newMux(room))
	defer srv.Close()

	first := joinRoom(t, srv.URL)
	room.Play()
	first.waitForPackets(t, 25, 5*time.Second) // 25 × 20 ms = half a second of audio

	late := joinRoom(t, srv.URL) // joins mid-track
	late.waitForPackets(t, 25, 5*time.Second)

	// The data channel tells listeners the room is playing.
	deadline := time.After(3 * time.Second)
	for playing := false; !playing; {
		select {
		case s := <-late.state:
			playing = s.Playing && s.Position > 0
		case <-deadline:
			t.Fatal("no playing state received over the data channel")
		}
	}

	// Pause stops the audio for everyone.
	room.Pause()
	time.Sleep(200 * time.Millisecond) // let in-flight packets arrive
	a, b := first.packets.Load(), late.packets.Load()
	time.Sleep(400 * time.Millisecond)
	if first.packets.Load() != a || late.packets.Load() != b {
		t.Errorf("audio kept flowing after pause: %d -> %d and %d -> %d packets",
			a, first.packets.Load(), b, late.packets.Load())
	}
}
