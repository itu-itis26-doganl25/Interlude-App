package main

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// Rooms holds one Room (its own stream and listeners) per Django room id. A
// room opens when its first listener connects and closes once it has been
// empty for a while.
type Rooms struct {
	trackPath string
	duration  time.Duration

	mu    sync.Mutex
	rooms map[int]*roomEntry
}

type roomEntry struct {
	room     *Room
	lastUsed time.Time // last request for this room; a joiner may be mid-handshake
}

// NewRooms checks the track once up front. Every room streams this track for
// now; picking each room's song comes with synchronized playback (WBS-11.2).
func NewRooms(trackPath string) (*Rooms, error) {
	duration, err := probeDuration(trackPath)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", trackPath, err)
	}
	return &Rooms{trackPath: trackPath, duration: duration, rooms: map[int]*roomEntry{}}, nil
}

// Get returns the room with this id, opening it if needed.
func (rs *Rooms) Get(id int) (*Room, error) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	e, ok := rs.rooms[id]
	if !ok {
		room, err := newRoom(rs.trackPath, rs.duration)
		if err != nil {
			return nil, err
		}
		e = &roomEntry{room: room}
		rs.rooms[id] = e
		log.Printf("room %d: opened", id)
	}
	e.lastUsed = time.Now()
	return e.room, nil
}

// Run pushes state to every room's listeners and closes idle rooms, until ctx ends.
func (rs *Rooms) Run(ctx context.Context, every, idle time.Duration) {
	tick := time.NewTicker(every)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-tick.C:
			rs.reap(now, idle)
			for _, r := range rs.all() {
				r.Broadcast()
			}
		}
	}
}

// reap closes rooms that have had no listeners and no requests for `idle`.
func (rs *Rooms) reap(now time.Time, idle time.Duration) {
	var closing []*Room
	rs.mu.Lock()
	for id, e := range rs.rooms {
		if e.room.listenerCount() == 0 && now.Sub(e.lastUsed) > idle {
			delete(rs.rooms, id)
			closing = append(closing, e.room)
			log.Printf("room %d: closed (empty)", id)
		}
	}
	rs.mu.Unlock()
	for _, r := range closing {
		r.Close()
	}
}

// CloseAll stops every room, e.g. on shutdown.
func (rs *Rooms) CloseAll() {
	for _, r := range rs.all() {
		r.Close()
	}
}

func (rs *Rooms) all() []*Room {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	list := make([]*Room, 0, len(rs.rooms))
	for _, e := range rs.rooms {
		list = append(list, e.room)
	}
	return list
}
