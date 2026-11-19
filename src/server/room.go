package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pion/interceptor"
	"github.com/pion/webrtc/v4"
)

// Opus at 48 kHz stereo. stereo=1 tells the browser to decode in stereo
// instead of folding the music down to mono (the default for voice calls).
var opusCodec = webrtc.RTPCodecCapability{
	MimeType:    webrtc.MimeTypeOpus,
	ClockRate:   48000,
	Channels:    2,
	SDPFmtpLine: "minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1",
}

var iceServers = []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}}

// Drift alignment: every listener buffers up to the same total delay (the room
// target), so fast listeners wait for the slowest one.
const (
	targetMarginMs = 20  // headroom above the slowest listener's need
	targetMaxMs    = 500 // never delay anyone more than this (NFR-09 budget)
	targetBandMs   = 30  // ignore small drops, to avoid constant retuning
	targetStepMs   = 25  // lower the target by at most this per broadcast (50 ms/s)
)

// Room is one listening room: a single audio track shared by every listener,
// plus the playback state the host controls. Rooms (rooms.go) keeps one per room id.
type Room struct {
	api       *webrtc.API
	track     *webrtc.TrackLocalStaticSample // encoded once, sent to every listener
	trackPath string
	duration  time.Duration

	control sync.Mutex // serializes play/pause/seek so they never overlap

	mu       sync.Mutex // guards everything below
	playing  bool
	position time.Duration      // how far into the track the server has sent
	stop     context.CancelFunc // stops the running stream
	done     chan struct{}      // closed when the running stream has exited
	peers    map[*Peer]struct{}
	nextID   int
	targetMs float64 // shared delay every listener aligns to; 0 until someone reports
}

// Peer is one connected listener.
type Peer struct {
	id      int
	name    string // username from the media token
	pc      *webrtc.PeerConnection
	dc      *webrtc.DataChannel // set once the listener's data channel opens
	delayMs *float64            // how far behind the server this listener hears now
	needMs  *float64            // the smallest delay it could manage by itself
}

func NewRoom(trackPath string) (*Room, error) {
	duration, err := probeDuration(trackPath)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", trackPath, err)
	}
	return newRoom(trackPath, duration)
}

func newRoom(trackPath string, duration time.Duration) (*Room, error) {
	// Register only our stereo Opus codec, plus Pion's default interceptors
	// (RTCP reports, NACK) so the browser gets the usual feedback.
	media := &webrtc.MediaEngine{}
	if err := media.RegisterCodec(
		webrtc.RTPCodecParameters{RTPCodecCapability: opusCodec, PayloadType: 111},
		webrtc.RTPCodecTypeAudio,
	); err != nil {
		return nil, err
	}
	registry := &interceptor.Registry{}
	if err := webrtc.RegisterDefaultInterceptors(media, registry); err != nil {
		return nil, err
	}

	track, err := webrtc.NewTrackLocalStaticSample(opusCodec, "audio", "interlude-room")
	if err != nil {
		return nil, err
	}

	return &Room{
		api:       webrtc.NewAPI(webrtc.WithMediaEngine(media), webrtc.WithInterceptorRegistry(registry)),
		track:     track,
		trackPath: trackPath,
		duration:  duration,
		peers:     map[*Peer]struct{}{},
	}, nil
}

// HandleOffer is the WebRTC handshake: the browser POSTs its offer, we attach
// the shared room track to a new peer connection and reply with our answer.
// `who` is the listener, from their media token.
func (r *Room) HandleOffer(w http.ResponseWriter, req *http.Request, who *Claims) {
	var offer webrtc.SessionDescription
	if err := json.NewDecoder(req.Body).Decode(&offer); err != nil {
		http.Error(w, "invalid offer", http.StatusBadRequest)
		return
	}
	answer, err := r.addPeer(offer, who.Name)
	if err != nil {
		log.Printf("offer failed: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, answer)
}

func (r *Room) addPeer(offer webrtc.SessionDescription, name string) (*webrtc.SessionDescription, error) {
	pc, err := r.api.NewPeerConnection(webrtc.Configuration{ICEServers: iceServers})
	if err != nil {
		return nil, err
	}

	sender, err := pc.AddTrack(r.track)
	if err != nil {
		pc.Close()
		return nil, err
	}
	// Pion needs incoming RTCP (receiver reports) to be read, or it backs up.
	go func() {
		buf := make([]byte, 1500)
		for {
			if _, _, err := sender.Read(buf); err != nil {
				return
			}
		}
	}()

	r.mu.Lock()
	r.nextID++
	p := &Peer{id: r.nextID, name: name, pc: pc}
	r.peers[p] = struct{}{}
	r.mu.Unlock()

	// The browser opens a data channel; we push playback state over it and it
	// sends back its measured delay.
	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		dc.OnOpen(func() {
			r.mu.Lock()
			p.dc = dc
			r.mu.Unlock()
		})
		dc.OnMessage(func(msg webrtc.DataChannelMessage) {
			var report struct {
				DelayMs *float64 `json:"delayMs"`
				NeedMs  *float64 `json:"needMs"` // null while the listener warms up
			}
			if json.Unmarshal(msg.Data, &report) == nil {
				r.mu.Lock()
				p.delayMs, p.needMs = report.DelayMs, report.NeedMs
				r.mu.Unlock()
			}
		})
	})

	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		log.Printf("listener %d (%s): %s", p.id, p.name, s)
		if s == webrtc.PeerConnectionStateFailed || s == webrtc.PeerConnectionStateClosed {
			r.removePeer(p)
		}
	})

	if err := pc.SetRemoteDescription(offer); err != nil {
		r.removePeer(p)
		return nil, err
	}
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		r.removePeer(p)
		return nil, err
	}
	// Wait until all our network candidates are in the answer, so one
	// request/response is enough (no trickle ICE needed for the spike).
	gathered := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		r.removePeer(p)
		return nil, err
	}
	<-gathered
	return pc.LocalDescription(), nil
}

func (r *Room) removePeer(p *Peer) {
	r.mu.Lock()
	_, present := r.peers[p]
	delete(r.peers, p)
	r.mu.Unlock()
	if present {
		go p.pc.Close() // closing inside a Pion callback can deadlock, so do it separately
	}
}

// HandleControl applies a host command: {"action": "play" | "pause" | "seek", "position": seconds}.
func (r *Room) HandleControl(w http.ResponseWriter, req *http.Request) {
	var cmd struct {
		Action   string  `json:"action"`
		Position float64 `json:"position"`
	}
	if err := json.NewDecoder(req.Body).Decode(&cmd); err != nil {
		http.Error(w, "invalid command", http.StatusBadRequest)
		return
	}
	switch cmd.Action {
	case "play":
		r.Play()
	case "pause":
		r.Pause()
	case "seek":
		r.Seek(time.Duration(cmd.Position * float64(time.Second)))
	default:
		http.Error(w, "unknown action", http.StatusBadRequest)
		return
	}
	log.Printf("host: %s", cmd.Action)
	writeJSON(w, r.State())
}

type ListenerInfo struct {
	ID      int      `json:"id"`
	Name    string   `json:"name"`
	State   string   `json:"state"`
	DelayMs *float64 `json:"delayMs"`
	NeedMs  *float64 `json:"needMs"`
}

type State struct {
	Playing    bool           `json:"playing"`
	Position   float64        `json:"position"` // seconds
	Duration   float64        `json:"duration"` // seconds
	Track      string         `json:"track"`
	Listeners  []ListenerInfo `json:"listeners"`
	MaxDriftMs *float64       `json:"maxDriftMs"` // spread between the slowest and fastest listener
	TargetMs   float64        `json:"targetMs"`   // delay every listener aligns to
}

func (r *Room) State() State {
	r.mu.Lock()
	defer r.mu.Unlock()
	s := State{
		Playing:   r.playing,
		Position:  r.position.Seconds(),
		Duration:  r.duration.Seconds(),
		Track:     filepath.Base(r.trackPath),
		Listeners: []ListenerInfo{},
		TargetMs:  r.targetMs,
	}
	var lo, hi float64
	measured := 0
	for p := range r.peers {
		s.Listeners = append(s.Listeners, ListenerInfo{
			ID: p.id, Name: p.name, State: p.pc.ConnectionState().String(), DelayMs: p.delayMs, NeedMs: p.needMs,
		})
		if p.delayMs != nil {
			if measured == 0 || *p.delayMs < lo {
				lo = *p.delayMs
			}
			if measured == 0 || *p.delayMs > hi {
				hi = *p.delayMs
			}
			measured++
		}
	}
	if measured >= 2 {
		drift := hi - lo
		s.MaxDriftMs = &drift
	}
	return s
}

// Broadcast retunes the shared delay and pushes the room state to every
// listener's data channel. Rooms.Run calls it twice a second.
func (r *Room) Broadcast() {
	r.updateTarget()
	msg, _ := json.Marshal(r.State())
	r.mu.Lock()
	var channels []*webrtc.DataChannel
	for p := range r.peers {
		if p.dc != nil {
			channels = append(channels, p.dc)
		}
	}
	r.mu.Unlock()
	for _, dc := range channels {
		_ = dc.SendText(string(msg)) // a closed channel just fails; the peer is removed separately
	}
}

// Close stops the stream and disconnects everyone.
func (r *Room) Close() {
	r.Pause()
	r.mu.Lock()
	peers := r.peers
	r.peers = map[*Peer]struct{}{}
	r.mu.Unlock()
	for p := range peers {
		if p.pc != nil {
			go p.pc.Close()
		}
	}
}

func (r *Room) listenerCount() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.peers)
}

// updateTarget sets the room's shared delay from the slowest listener's need.
// It rises at once (so nobody runs out of buffered audio) and falls slowly.
func (r *Room) updateTarget() {
	r.mu.Lock()
	defer r.mu.Unlock()
	var slowest float64
	reported := false
	for p := range r.peers {
		if p.needMs != nil {
			slowest = max(slowest, *p.needMs)
			reported = true
		}
	}
	if !reported {
		r.targetMs = 0
		return
	}
	want := min(slowest+targetMarginMs, targetMaxMs)
	switch {
	case want > r.targetMs:
		r.targetMs = want
	case want < r.targetMs-targetBandMs:
		r.targetMs -= targetStepMs
	}
}

func probeDuration(path string) (time.Duration, error) {
	out, err := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1", path).Output()
	if err != nil {
		return 0, err
	}
	secs, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil {
		return 0, err
	}
	return time.Duration(secs * float64(time.Second)), nil
}
