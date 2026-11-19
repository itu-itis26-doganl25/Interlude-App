package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pion/webrtc/v4"
)

func ptr(v float64) *float64 { return &v }

// roomWithNeeds builds a room whose listeners reported the given needs (nil = still warming up).
func roomWithNeeds(target float64, needs ...*float64) *Room {
	r := &Room{peers: map[*Peer]struct{}{}, targetMs: target}
	for i, n := range needs {
		r.peers[&Peer{id: i + 1, needMs: n}] = struct{}{}
	}
	return r
}

func TestUpdateTarget(t *testing.T) {
	tests := []struct {
		name   string
		start  float64
		needs  []*float64
		wantMs float64
	}{
		{"nobody reported yet", 120, []*float64{nil, nil}, 0},
		{"slowest need plus margin", 0, []*float64{ptr(40), ptr(100)}, 120},
		{"rises at once", 120, []*float64{ptr(300)}, 320},
		{"small drop is ignored", 320, []*float64{ptr(290)}, 320},
		{"large drop falls one step", 320, []*float64{ptr(100)}, 295},
		{"capped at 500 ms", 0, []*float64{ptr(900)}, 500},
		{"warming-up listener is ignored", 0, []*float64{nil, ptr(50)}, 70},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := roomWithNeeds(tt.start, tt.needs...)
			r.updateTarget()
			if r.targetMs != tt.wantMs {
				t.Errorf("target = %v ms, want %v ms", r.targetMs, tt.wantMs)
			}
		})
	}
}

func TestUpdateTargetSettlesAfterSlowListenerLeaves(t *testing.T) {
	r := roomWithNeeds(500, ptr(100))
	for range 40 { // 20 s of broadcasts
		r.updateTarget()
	}
	// Settles within the ignore band above the new want (100 + 20 margin).
	if r.targetMs < 120 || r.targetMs > 120+targetBandMs {
		t.Errorf("target = %v ms, want between 120 and %v ms", r.targetMs, 120+targetBandMs)
	}
}

func TestStateReportsDriftBetweenListeners(t *testing.T) {
	newPeer := func(id int, delay *float64) *Peer {
		pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { pc.Close() })
		return &Peer{id: id, pc: pc, delayMs: delay}
	}

	r := &Room{peers: map[*Peer]struct{}{}}
	r.peers[newPeer(1, ptr(40))] = struct{}{}
	if s := r.State(); s.MaxDriftMs != nil {
		t.Errorf("drift with one listener = %v, want none", *s.MaxDriftMs)
	}

	r.peers[newPeer(2, ptr(65))] = struct{}{}
	r.peers[newPeer(3, nil)] = struct{}{} // not measured yet
	s := r.State()
	if s.MaxDriftMs == nil || *s.MaxDriftMs != 25 {
		t.Errorf("drift = %v, want 25 ms", s.MaxDriftMs)
	}
	if len(s.Listeners) != 3 {
		t.Errorf("listeners = %d, want 3", len(s.Listeners))
	}
}

func TestHandleControlRejectsBadInput(t *testing.T) {
	r := &Room{peers: map[*Peer]struct{}{}}
	for _, body := range []string{"not json", `{"action":"rewind"}`} {
		rec := httptest.NewRecorder()
		r.HandleControl(rec, httptest.NewRequest(http.MethodPost, "/control", strings.NewReader(body)))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: status %d, want 400", body, rec.Code)
		}
	}
}

func TestHandleOfferRejectsInvalidOffer(t *testing.T) {
	r := &Room{peers: map[*Peer]struct{}{}}
	rec := httptest.NewRecorder()
	r.HandleOffer(rec, httptest.NewRequest(http.MethodPost, "/offer", strings.NewReader("{")), &Claims{Name: "ayse"})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status %d, want 400", rec.Code)
	}
}
