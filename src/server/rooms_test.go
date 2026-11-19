package main

import (
	"testing"
	"time"
)

func TestRoomsKeepsOneRoomPerID(t *testing.T) {
	rs, err := NewRooms(testTrack(t, 3*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	a, _ := rs.Get(1)
	again, _ := rs.Get(1)
	other, _ := rs.Get(2)
	if a != again {
		t.Error("room 1 was created twice")
	}
	if a == other {
		t.Error("rooms 1 and 2 share a stream")
	}
}

func TestReapClosesOnlyEmptyIdleRooms(t *testing.T) {
	now := time.Now()
	empty := &Room{peers: map[*Peer]struct{}{}}
	busy := &Room{peers: map[*Peer]struct{}{{id: 1}: {}}}
	recent := &Room{peers: map[*Peer]struct{}{}}
	rs := &Rooms{rooms: map[int]*roomEntry{
		1: {room: empty, lastUsed: now.Add(-2 * time.Minute)},
		2: {room: busy, lastUsed: now.Add(-2 * time.Minute)},
		3: {room: recent, lastUsed: now.Add(-10 * time.Second)},
	}}

	rs.reap(now, time.Minute)

	if _, ok := rs.rooms[1]; ok {
		t.Error("empty idle room 1 was kept")
	}
	if _, ok := rs.rooms[2]; !ok {
		t.Error("room 2 with a listener was closed")
	}
	if _, ok := rs.rooms[3]; !ok {
		t.Error("room 3, used 10 s ago, was closed (someone may be joining)")
	}
}
