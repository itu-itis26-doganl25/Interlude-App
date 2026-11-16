import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BrowseScreen from '@/app/(tabs)/index';
import { musicService } from '@/services';
import { mockUseAuth } from '../helpers/auth';
import { makeAlbum, makeRoom, makeSong, makeUser } from '../helpers/fixtures';
import { mockRouter } from '../helpers/mockRouter';

jest.mock('@/providers/AuthProvider');
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  musicService: { getBrowseFeed: jest.fn(), search: jest.fn() },
}));

const svc = musicService as jest.Mocked<typeof musicService>;
const feed = {
  liveRooms: [makeRoom()],
  trendingSongs: [makeSong()],
  newReleases: [makeAlbum()],
};
const searchBox = () => screen.getByPlaceholderText('Songs, artists, albums, rooms');

beforeEach(() => {
  mockUseAuth({ user: makeUser({ displayName: 'Taha' }) });
  svc.getBrowseFeed.mockResolvedValue(feed);
});

describe('Home (Browse & Search)', () => {
  it('greets the user by name', async () => {
    await render(<BrowseScreen />);
    expect(screen.getByText('Hi, Taha!')).toBeOnTheScreen();
    await screen.findByText('Trending');
  });

  it('shows live rooms, trending songs and new releases', async () => {
    await render(<BrowseScreen />);
    expect(await screen.findByText('Live rooms')).toBeOnTheScreen();
    expect(screen.getByText('Late Night Lo-Fi')).toBeOnTheScreen();
    expect(screen.getByText('Trending')).toBeOnTheScreen();
    expect(screen.getByText('Midnight Static')).toBeOnTheScreen();
    expect(screen.getByText('New releases')).toBeOnTheScreen();
    expect(screen.getByText('Static Dreams')).toBeOnTheScreen();
  });

  it('shows an error and recovers on retry', async () => {
    svc.getBrowseFeed.mockReset();
    svc.getBrowseFeed.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(feed);
    await render(<BrowseScreen />);
    expect(await screen.findByText('Could not load music. Please try again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Live rooms')).toBeOnTheScreen();
  });

  it('opens the profile tab from the avatar', async () => {
    await render(<BrowseScreen />);
    await fireEvent.press(screen.getByLabelText('Open profile'));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/profile');
    await screen.findByText('Trending');
  });

  it('replaces the feed with search results while typing', async () => {
    svc.search.mockResolvedValue({
      songs: [makeSong({ id: 's9', title: 'Nova Song' })],
      albums: [],
      artists: [makeUser({ id: 'a1', displayName: 'Nova Wave', role: 'musician' })],
      rooms: [],
    });
    await render(<BrowseScreen />);
    await screen.findByText('Trending');
    await fireEvent.changeText(searchBox(), 'nova');
    expect(await screen.findByText('Nova Song')).toBeOnTheScreen();
    expect(svc.search).toHaveBeenCalledWith('nova');
    expect(screen.getByText('Songs')).toBeOnTheScreen();
    expect(screen.getByText('Artists')).toBeOnTheScreen();
    expect(screen.queryByText('Trending')).toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    svc.search.mockResolvedValue({ songs: [], albums: [], artists: [], rooms: [] });
    await render(<BrowseScreen />);
    await screen.findByText('Trending');
    await fireEvent.changeText(searchBox(), 'zzz');
    expect(await screen.findByText('No results found.')).toBeOnTheScreen();
  });

  it('returns to the feed when the search is cleared', async () => {
    svc.search.mockResolvedValue({ songs: [], albums: [], artists: [], rooms: [] });
    await render(<BrowseScreen />);
    await screen.findByText('Trending');
    await fireEvent.changeText(searchBox(), 'zzz');
    await screen.findByText('No results found.');
    await fireEvent.press(screen.getByLabelText('Clear search'));
    expect(await screen.findByText('Trending')).toBeOnTheScreen();
  });
});