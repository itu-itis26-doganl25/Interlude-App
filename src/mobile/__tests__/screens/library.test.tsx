import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LibraryScreen from '@/app/(tabs)/library';
import { makeAlbum, makeLibrary, makePlaylist, makeSong, makeUser } from '../helpers/fixtures';
import { mockUseLibrary } from '../helpers/library';
import { mockUsePlayer } from '../helpers/player';
import { mockRouter } from '../helpers/mockRouter';

jest.mock('@/providers/LibraryProvider');
jest.mock('@/providers/PlayerProvider');

const likedSong = makeSong({ id: 's1', title: 'Liked Song' });
const library = makeLibrary({
  likedSongs: [likedSong],
  savedAlbums: [makeAlbum({ title: 'Saved Album' })],
  followedArtists: [makeUser({ id: 'a1', displayName: 'Nova Wave', role: 'musician' })],
  playlists: [makePlaylist({ name: 'Chill Mix', songIds: ['s1', 's2'] }), makePlaylist({ id: 'p2', name: 'Solo', songIds: ['s1'] })],
});

beforeEach(() => {
  mockUseLibrary({ library });
  mockUsePlayer();
});

const tab = (name: string) => screen.getByRole('tab', { name });

describe('Library screen', () => {
  it('shows the title, the filters and the liked songs by default', async () => {
    await render(<LibraryScreen />);
    expect(screen.getByText('Your Library')).toBeOnTheScreen();
    expect(tab('Songs')).toBeSelected();
    expect(screen.getByText('Liked Song')).toBeOnTheScreen();
    expect(screen.queryByText('Saved Album')).toBeNull();
  });

  it('plays a liked song with the liked songs as the queue', async () => {
    const player = mockUsePlayer();
    await render(<LibraryScreen />);
    await fireEvent.press(screen.getByText('Liked Song'));
    expect(player.play).toHaveBeenCalledWith(likedSong, library.likedSongs);
  });

  it('shows saved albums', async () => {
    await render(<LibraryScreen />);
    await fireEvent.press(tab('Albums'));
    expect(tab('Albums')).toBeSelected();
    expect(screen.getByText('Saved Album')).toBeOnTheScreen();
    expect(screen.queryByText('Liked Song')).toBeNull();
  });

  it('shows followed artists and opens their profile', async () => {
    await render(<LibraryScreen />);
    await fireEvent.press(tab('Artists'));
    await fireEvent.press(screen.getByText('Nova Wave'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'a1' } });
  });

  it('lists playlists with their song counts', async () => {
    await render(<LibraryScreen />);
    await fireEvent.press(tab('Playlists'));
    expect(screen.getByText('Chill Mix')).toBeOnTheScreen();
    expect(screen.getByText('2 songs')).toBeOnTheScreen();
    expect(screen.getByText('1 song')).toBeOnTheScreen();
  });

  it.each([
    ['Songs', 'No liked songs yet.', { likedSongs: [] }],
    ['Albums', 'No saved albums yet.', { savedAlbums: [] }],
    ['Artists', 'You are not following any artists yet.', { followedArtists: [] }],
    ['Playlists', 'No playlists yet.', { playlists: [] }],
  ] as const)('shows an empty state for %s', async (name, message, empty) => {
    mockUseLibrary({ library: makeLibrary(empty) });
    await render(<LibraryScreen />);
    await fireEvent.press(tab(name));
    expect(screen.getByText(message)).toBeOnTheScreen();
  });

  it('explains that creating playlists is coming soon', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<LibraryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'New playlist' }));
    expect(spy).toHaveBeenCalledWith('New playlist', expect.any(String));
    spy.mockRestore();
  });

  it('shows an error and retries', async () => {
    const lib = mockUseLibrary({ library: null, error: 'Could not load your library.' });
    await render(<LibraryScreen />);
    expect(screen.getByText('Could not load your library.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(lib.retry).toHaveBeenCalled();
  });
});