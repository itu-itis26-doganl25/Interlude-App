import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PlayerScreen from '@/app/player';
import { makeQueueItem, makeSong } from '../helpers/fixtures';
import { mockUseLibrary } from '../helpers/library';
import { mockUsePlayer } from '../helpers/player';
import { mockRouter } from '../helpers/mockRouter';

jest.mock('@/providers/PlayerProvider');
jest.mock('@/providers/LibraryProvider');

const current = makeSong({ id: 's1', title: 'Song 1', artistId: 'a1', artistName: 'Nova Wave', durationMs: 200_000 });
const next = makeSong({ id: 's2', title: 'Song 2' });
const queue = [makeQueueItem(current), makeQueueItem(next)];

beforeEach(() => {
  mockUsePlayer({ currentSong: current, queue, currentIndex: 0 });
  mockUseLibrary();
});

describe('Player screen', () => {
  it('shows the current song and the controls', async () => {
    await render(<PlayerScreen />);
    expect(screen.getByText('Song 1')).toBeOnTheScreen();
    expect(screen.getByText('Nova Wave')).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Seek' })).toBeOnTheScreen();
    for (const label of ['Shuffle', 'Previous', 'Play', 'Next', 'Repeat off']) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
  });

  it('says nothing is playing when the queue is empty', async () => {
    mockUsePlayer();
    await render(<PlayerScreen />);
    expect(screen.getByText('Nothing is playing')).toBeOnTheScreen();
  });

  it('opens the artist profile', async () => {
    await render(<PlayerScreen />);
    await fireEvent.press(screen.getByText('Nova Wave'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'a1' } });
  });

  it('closes the player', async () => {
    await render(<PlayerScreen />);
    await fireEvent.press(screen.getByLabelText('Close player'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('likes the song', async () => {
    const lib = mockUseLibrary();
    await render(<PlayerScreen />);
    await fireEvent.press(screen.getByLabelText('Like'));
    expect(lib.toggleLike).toHaveBeenCalledWith(current);
  });

  it('shows Unlike for a liked song and unlikes it', async () => {
    const lib = mockUseLibrary({ isLiked: jest.fn((id: string) => id === 's1') });
    await render(<PlayerScreen />);
    await fireEvent.press(screen.getByLabelText('Unlike'));
    expect(lib.toggleLike).toHaveBeenCalledWith(current);
  });

  it('toggles the queue view', async () => {
    await render(<PlayerScreen />);
    expect(screen.queryByText('Next in queue')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Queue'));
    expect(screen.getByText('Next in queue')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Autoplay' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Close queue'));
    expect(screen.queryByText('Next in queue')).toBeNull();
  });

  it('explains that listening together comes with Rooms', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<PlayerScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Listen together' }));
    expect(spy).toHaveBeenCalledWith('Listen together', expect.any(String));
    spy.mockRestore();
  });

  it('seeks through the seek bar', async () => {
    const player = mockUsePlayer({ currentSong: current, queue, currentIndex: 0, positionMs: 12_000 });
    await render(<PlayerScreen />);
    await fireEvent(screen.getByRole('adjustable', { name: 'Seek' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(player.seek).toHaveBeenCalledWith(22_000);
  });
});