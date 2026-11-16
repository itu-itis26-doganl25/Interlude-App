import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AlbumRow } from '@/components/AlbumRow';
import { RoomCard } from '@/components/RoomCard';
import { SongRow } from '@/components/SongRow';
import { UserRow } from '@/components/UserRow';
import { MetricCard } from '@/components/studio/MetricCard';
import { RankedRow } from '@/components/studio/RankedRow';
import { StatItem } from '@/components/profile/StatItem';
import { StudioSummaryCard } from '@/components/profile/StudioSummaryCard';
import { makeAlbum, makeRoom, makeSong, makeUser } from '../helpers/fixtures';
import { mockRouter } from '../helpers/mockRouter';

describe('SongRow', () => {
  it('shows title, artist, play count and duration', async () => {
    await render(<SongRow song={makeSong()} />);
    expect(screen.getByText('Midnight Static')).toBeOnTheScreen();
    expect(screen.getByText('Nova Wave · 1.2M plays')).toBeOnTheScreen();
    expect(screen.getByText('3:34')).toBeOnTheScreen();
  });

  it('passes the song to onPress', async () => {
    const onPress = jest.fn();
    const song = makeSong();
    await render(<SongRow song={song} onPress={onPress} />);
    await fireEvent.press(screen.getByText('Midnight Static'));
    expect(onPress).toHaveBeenCalledWith(song);
  });
});

describe('AlbumRow', () => {
  it('shows artist, year and track count', async () => {
    await render(<AlbumRow album={makeAlbum()} />);
    expect(screen.getByText('Static Dreams')).toBeOnTheScreen();
    expect(screen.getByText('Nova Wave · 2026 · 2 tracks')).toBeOnTheScreen();
  });

  it('uses the singular for one track', async () => {
    await render(<AlbumRow album={makeAlbum({ songIds: ['s1'] })} />);
    expect(screen.getByText('Nova Wave · 2026 · 1 track')).toBeOnTheScreen();
  });
});

describe('RoomCard', () => {
  it('shows name, host, listeners and the song playing now', async () => {
    await render(<RoomCard room={makeRoom()} />);
    expect(screen.getByText('Late Night Lo-Fi')).toBeOnTheScreen();
    expect(screen.getByText('Hosted by Nova Wave')).toBeOnTheScreen();
    expect(screen.getByText('128 listening')).toBeOnTheScreen();
    expect(screen.getByText('● LIVE')).toBeOnTheScreen();
    expect(screen.getByText('♪ Midnight Static — Nova Wave')).toBeOnTheScreen();
  });

  it('hides the LIVE badge and now-playing line when not applicable', async () => {
    await render(<RoomCard room={makeRoom({ isLive: false, currentSong: null })} />);
    expect(screen.queryByText('● LIVE')).toBeNull();
    expect(screen.queryByText(/♪/)).toBeNull();
  });
});

describe('UserRow', () => {
  it('labels musicians as Artist and listeners as Listener', async () => {
    const { rerender } = await render(<UserRow user={makeUser({ role: 'musician' })} />);
    expect(screen.getByText('Artist')).toBeOnTheScreen();
    await rerender(<UserRow user={makeUser({ role: 'listener' })} />);
    expect(screen.getByText('Listener')).toBeOnTheScreen();
  });

  it('opens the user profile', async () => {
    await render(<UserRow user={makeUser({ id: 'u9', displayName: 'melis' })} />);
    await fireEvent.press(screen.getByText('melis'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'u9' } });
  });
});

describe('StatItem', () => {
  it('is pressable when onPress is given', async () => {
    const onPress = jest.fn();
    await render(<StatItem value="42" label="Followers" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Followers'));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows value and label without onPress', async () => {
    await render(<StatItem value="3.4K" label="Listens" />);
    expect(screen.getByText('3.4K')).toBeOnTheScreen();
    expect(screen.getByText('Listens')).toBeOnTheScreen();
  });
});

describe('MetricCard', () => {
  it('shows an upward change', async () => {
    await render(<MetricCard label="Total plays" metric={{ value: 3000, previous: 2500 }} />);
    expect(screen.getByText('3K')).toBeOnTheScreen();
    expect(screen.getByText('▲ 20.0%')).toBeOnTheScreen();
  });

  it('shows a downward change', async () => {
    await render(<MetricCard label="New followers" metric={{ value: 36, previous: 40 }} />);
    expect(screen.getByText('▼ 10.0%')).toBeOnTheScreen();
  });

  it('hides the change when there is no previous value', async () => {
    await render(<MetricCard label="Total plays" metric={{ value: 10, previous: 0 }} />);
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('uses a custom formatter', async () => {
    await render(<MetricCard label="Avg. listened" metric={{ value: 68, previous: 64 }} format={(n) => `${n}%`} />);
    expect(screen.getByText('68%')).toBeOnTheScreen();
  });
});

describe('RankedRow', () => {
  it('shows rank, title, subtitle and value', async () => {
    await render(<RankedRow rank={1} title="Turkey" subtitle="640 listeners" value="46%" share={1} />);
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByText('Turkey')).toBeOnTheScreen();
    expect(screen.getByText('640 listeners')).toBeOnTheScreen();
    expect(screen.getByText('46%')).toBeOnTheScreen();
  });
});

describe('StudioSummaryCard', () => {
  const summary = { totalPlays: 2_540_000, last7Days: [100, 200, 300] };

  it('shows total plays and the weekly total', async () => {
    await render(<StudioSummaryCard summary={summary} onPress={jest.fn()} />);
    expect(screen.getByText('Studio')).toBeOnTheScreen();
    expect(screen.getByText('2.5M')).toBeOnTheScreen();
    expect(screen.getByText('+600 this week')).toBeOnTheScreen();
  });

  it('is pressable', async () => {
    const onPress = jest.fn();
    await render(<StudioSummaryCard summary={summary} onPress={onPress} />);
    await fireEvent.press(screen.getByText('Open ›'));
    expect(onPress).toHaveBeenCalled();
  });
});