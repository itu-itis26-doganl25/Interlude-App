import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { PlayerControls } from '@/components/player/PlayerControls';
import { QueueList } from '@/components/player/QueueList';
import { SeekBar } from '@/components/player/SeekBar';
import { makeQueueItem, makeSong } from '../helpers/fixtures';
import { mockUsePlayer } from '../helpers/player';
import { mockRouter } from '../helpers/mockRouter';

jest.mock('@/providers/PlayerProvider');

const s = (n: number) => makeSong({ id: `s${n}`, title: `Song ${n}`, durationMs: 200_000 });

describe('MiniPlayer', () => {
  it('renders nothing when no song is loaded', async () => {
    mockUsePlayer();
    await render(<MiniPlayer />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the current song', async () => {
    mockUsePlayer({ currentSong: s(1) });
    await render(<MiniPlayer />);
    expect(screen.getByText('Song 1')).toBeOnTheScreen();
    expect(screen.getByText('Nova Wave')).toBeOnTheScreen();
  });

  it('shows Play when paused and toggles', async () => {
    const player = mockUsePlayer({ currentSong: s(1), isPlaying: false });
    await render(<MiniPlayer />);
    await fireEvent.press(screen.getByLabelText('Play'));
    expect(player.toggle).toHaveBeenCalled();
  });

  it('shows Pause while playing', async () => {
    mockUsePlayer({ currentSong: s(1), isPlaying: true });
    await render(<MiniPlayer />);
    expect(screen.getByLabelText('Pause')).toBeOnTheScreen();
  });

  it('opens the full player when pressed', async () => {
    mockUsePlayer({ currentSong: s(1) });
    await render(<MiniPlayer />);
    await fireEvent.press(screen.getByText('Song 1'));
    expect(mockRouter.push).toHaveBeenCalledWith('/player');
  });

  it('exposes playback progress', async () => {
    mockUsePlayer({ currentSong: s(1), positionMs: 50_000 });
    await render(<MiniPlayer />);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ min: 0, max: 200_000, now: 50_000 });
  });
});

describe('SeekBar', () => {
  it('shows elapsed and remaining time', async () => {
    await render(<SeekBar positionMs={12_000} durationMs={200_000} onSeek={jest.fn()} />);
    expect(screen.getByText('0:12')).toBeOnTheScreen();
    expect(screen.getByText('-3:08')).toBeOnTheScreen();
  });

  it('exposes its value for accessibility', async () => {
    await render(<SeekBar positionMs={12_000} durationMs={200_000} onSeek={jest.fn()} />);
    const bar = screen.getByRole('adjustable', { name: 'Seek' });
    expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 200_000, now: 12_000 });
  });

  const act10 = (name: 'increment' | 'decrement') =>
    fireEvent(screen.getByRole('adjustable', { name: 'Seek' }), 'accessibilityAction', {
      nativeEvent: { actionName: name },
    });

  it('seeks 10 seconds forward and back', async () => {
    const onSeek = jest.fn();
    await render(<SeekBar positionMs={12_000} durationMs={200_000} onSeek={onSeek} />);
    await act10('increment');
    expect(onSeek).toHaveBeenLastCalledWith(22_000);
    await act10('decrement');
    expect(onSeek).toHaveBeenLastCalledWith(2_000);
  });

  it('clamps to the start and the end', async () => {
    const onSeek = jest.fn();
    const { rerender } = await render(<SeekBar positionMs={5_000} durationMs={200_000} onSeek={onSeek} />);
    await act10('decrement');
    expect(onSeek).toHaveBeenLastCalledWith(0);
    await rerender(<SeekBar positionMs={195_000} durationMs={200_000} onSeek={onSeek} />);
    await act10('increment');
    expect(onSeek).toHaveBeenLastCalledWith(200_000);
  });
});

describe('PlayerControls', () => {
  it('toggles play/pause', async () => {
    const player = mockUsePlayer({ currentSong: s(1), isPlaying: false });
    const { rerender } = await render(<PlayerControls />);
    await fireEvent.press(screen.getByLabelText('Play'));
    expect(player.toggle).toHaveBeenCalledTimes(1);
    mockUsePlayer({ currentSong: s(1), isPlaying: true });
    await rerender(<PlayerControls />);
    expect(screen.getByLabelText('Pause')).toBeOnTheScreen();
  });

  it('skips to the next and previous song', async () => {
    const player = mockUsePlayer({ currentSong: s(1) });
    await render(<PlayerControls />);
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Previous'));
    expect(player.next).toHaveBeenCalled();
    expect(player.previous).toHaveBeenCalled();
  });

  it('toggles shuffle and shows its state', async () => {
    const player = mockUsePlayer({ currentSong: s(1), shuffle: true });
    await render(<PlayerControls />);
    const shuffle = screen.getByLabelText('Shuffle');
    expect(shuffle).toBeSelected();
    await fireEvent.press(shuffle);
    expect(player.toggleShuffle).toHaveBeenCalled();
  });

  it('shows shuffle as off by default', async () => {
    mockUsePlayer({ currentSong: s(1), shuffle: false });
    await render(<PlayerControls />);
    expect(screen.getByLabelText('Shuffle')).not.toBeSelected();
  });

  it.each([['off'], ['all'], ['one']] as const)('labels the repeat button for mode "%s"', async (mode) => {
    const player = mockUsePlayer({ currentSong: s(1), repeat: mode });
    await render(<PlayerControls />);
    await fireEvent.press(screen.getByLabelText(`Repeat ${mode}`));
    expect(player.cycleRepeat).toHaveBeenCalled();
  });
});

describe('QueueList', () => {
  const queue = [
    makeQueueItem(s(1)),
    makeQueueItem(s(2)),
    makeQueueItem(s(3)),
    makeQueueItem(s(4), 'recommended'),
  ];

  it('separates the queue from recommendations and hides what already played', async () => {
    mockUsePlayer({ currentSong: s(2), queue, currentIndex: 1 });
    await render(<QueueList />);
    expect(screen.getByText('Next in queue')).toBeOnTheScreen();
    expect(screen.getByText('Song 3')).toBeOnTheScreen();
    expect(screen.getByText('Recommended')).toBeOnTheScreen();
    expect(screen.getByText('Song 4')).toBeOnTheScreen();
    expect(screen.queryByText('Song 1')).toBeNull();
  });

  it('omits the Recommended section when there are none', async () => {
    mockUsePlayer({ currentSong: s(1), queue: queue.slice(0, 2), currentIndex: 0 });
    await render(<QueueList />);
    expect(screen.queryByText('Recommended')).toBeNull();
  });

  it('jumps to the pressed item using its queue index', async () => {
    const player = mockUsePlayer({ currentSong: s(2), queue, currentIndex: 1 });
    await render(<QueueList />);
    await fireEvent.press(screen.getByText('Song 3'));
    expect(player.playQueueItem).toHaveBeenCalledWith(2);
    await fireEvent.press(screen.getByText('Song 4'));
    expect(player.playQueueItem).toHaveBeenCalledWith(3);
  });

  it('has an Autoplay switch that reflects and changes the setting', async () => {
    const player = mockUsePlayer({ currentSong: s(1), queue, currentIndex: 0, autoplay: true });
    await render(<QueueList />);
    const toggle = screen.getByRole('switch', { name: 'Autoplay' });
    expect(toggle).toBeChecked();
    await fireEvent.press(toggle);
    expect(player.setAutoplay).toHaveBeenCalledWith(false);
  });

  it('shows Autoplay as off', async () => {
    const player = mockUsePlayer({ currentSong: s(1), queue, currentIndex: 0, autoplay: false });
    await render(<QueueList />);
    const toggle = screen.getByRole('switch', { name: 'Autoplay' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(player.setAutoplay).toHaveBeenCalledWith(true);
  });
});