import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ProfileView } from '@/components/profile/ProfileView';
import { userService } from '@/services';
import { mockUseAuth } from '../helpers/auth';
import { makeAlbum, makeProfile, makeSong, makeUser } from '../helpers/fixtures';
import { mockRouter } from '../helpers/mockRouter';

jest.mock('@/providers/AuthProvider');
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  userService: { getProfile: jest.fn(), setFollowing: jest.fn() },
}));

const svc = userService as jest.Mocked<typeof userService>;
const me = makeUser({ id: 'u1', displayName: 'Taha' });
const artist = makeUser({ id: 'a1', displayName: 'Nova Wave', role: 'musician' });

const listenerProfile = makeProfile({
  user: me,
  recentlyPlayed: [makeSong({ title: 'Recent Song' })],
  followedArtists: [artist],
});
const musicianProfile = makeProfile({
  user: artist,
  bio: 'Producer from Istanbul.',
  links: [{ label: 'Instagram', url: 'https://instagram.com' }],
  popularSongs: [makeSong({ title: 'Popular Song' })],
  albums: [makeAlbum({ title: 'Debut Album' })],
  studioSummary: { totalPlays: 2_540_000, last7Days: [100, 200, 300] },
});

beforeEach(() => {
  mockUseAuth({ user: me });
});

describe('ProfileView – own listener profile', () => {
  beforeEach(() => svc.getProfile.mockResolvedValue(listenerProfile));

  it('shows header, stats and listener sections', async () => {
    await render(<ProfileView userId="u1" />);
    expect(await screen.findByText('Taha')).toBeOnTheScreen();
    expect(screen.getByText('Listener')).toBeOnTheScreen();
    expect(screen.getByText('Followers')).toBeOnTheScreen();
    expect(screen.getByText('Following')).toBeOnTheScreen();
    expect(screen.getByText('Listens')).toBeOnTheScreen();
    expect(screen.getByText('Recently played')).toBeOnTheScreen();
    expect(screen.getByText('Recent Song')).toBeOnTheScreen();
    expect(screen.getByText('Following artists')).toBeOnTheScreen();
    expect(screen.getByText('Nova Wave')).toBeOnTheScreen();
  });

  it('shows owner controls but no studio card or follow button', async () => {
    await render(<ProfileView userId="u1" />);
    await screen.findByText('Taha');
    expect(screen.getByLabelText('Find people')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    expect(screen.queryByText('Studio')).toBeNull();
  });

  it('opens the followers and following lists', async () => {
    await render(<ProfileView userId="u1" />);
    await screen.findByText('Taha');
    await fireEvent.press(screen.getByText('Followers'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/connections',
      params: { userId: 'u1', kind: 'followers' },
    });
    await fireEvent.press(screen.getByText('Following'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/connections',
      params: { userId: 'u1', kind: 'following' },
    });
  });

  it('opens user search from the magnifying glass', async () => {
    await render(<ProfileView userId="u1" />);
    await screen.findByText('Taha');
    await fireEvent.press(screen.getByLabelText('Find people'));
    expect(mockRouter.push).toHaveBeenCalledWith('/user-search');
  });

  it('opens a followed artist’s profile', async () => {
    await render(<ProfileView userId="u1" />);
    await screen.findByText('Recently played');
    await fireEvent.press(screen.getByText('Nova Wave'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'a1' } });
  });

  it('logs out', async () => {
    const auth = mockUseAuth({ user: me });
    await render(<ProfileView userId="u1" />);
    await screen.findByText('Taha');
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalled();
  });
});

describe('ProfileView – delete account', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    svc.getProfile.mockResolvedValue(listenerProfile);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  const open = async () => {
    await render(<ProfileView userId="u1" />);
    await screen.findByText('Taha');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    const [title, , buttons] = alertSpy.mock.calls[0];
    return { title, buttons: buttons as { text: string; style?: string; onPress?: () => Promise<void> }[] };
  };

  it('asks for confirmation before deleting', async () => {
    const auth = mockUseAuth({ user: me });
    const { title, buttons } = await open();
    expect(title).toBe('Delete account?');
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account when confirmed', async () => {
    const auth = mockUseAuth({ user: me });
    const { buttons } = await open();
    await act(async () => {
      await buttons.find((b) => b.style === 'destructive')!.onPress!();
    });
    expect(auth.deleteAccount).toHaveBeenCalled();
  });

  it('shows an error alert when deleting fails', async () => {
    mockUseAuth({ user: me, deleteAccount: jest.fn().mockRejectedValue(new Error('x')) });
    const { buttons } = await open();
    await act(async () => {
      await buttons.find((b) => b.style === 'destructive')!.onPress!();
    });
    expect(alertSpy).toHaveBeenLastCalledWith('Something went wrong', expect.any(String));
  });
});

describe('ProfileView – own musician profile', () => {
  beforeEach(() => {
    mockUseAuth({ user: artist });
    svc.getProfile.mockResolvedValue(musicianProfile);
  });

  it('shows studio card, catalogue, bio and links but no listener sections', async () => {
    await render(<ProfileView userId="a1" />);
    expect(await screen.findByText('Nova Wave')).toBeOnTheScreen();
    expect(screen.getByText('Musician')).toBeOnTheScreen();
    expect(screen.getByText('Plays')).toBeOnTheScreen();
    expect(screen.getByText('Studio')).toBeOnTheScreen();
    expect(screen.getByText('Popular songs')).toBeOnTheScreen();
    expect(screen.getByText('Popular Song')).toBeOnTheScreen();
    expect(screen.getByText('Albums')).toBeOnTheScreen();
    expect(screen.getByText('Debut Album')).toBeOnTheScreen();
    expect(screen.getByText('Producer from Istanbul.')).toBeOnTheScreen();
    expect(screen.getByText('Instagram')).toBeOnTheScreen();
    expect(screen.queryByText('Recently played')).toBeNull();
    expect(screen.queryByText('Following artists')).toBeNull();
  });

  it('opens the studio from the summary card', async () => {
    await render(<ProfileView userId="a1" />);
    await screen.findByText('Studio');
    await fireEvent.press(screen.getByText('Open ›'));
    expect(mockRouter.push).toHaveBeenCalledWith('/studio');
  });
});

describe('ProfileView – someone else’s profile', () => {
  beforeEach(() => {
    mockUseAuth({ user: me });
    svc.getProfile.mockResolvedValue({ ...musicianProfile, studioSummary: null });
    svc.setFollowing.mockResolvedValue(undefined);
  });

  it('shows a Follow button and hides owner controls', async () => {
    await render(<ProfileView userId="a1" />);
    expect(await screen.findByRole('button', { name: 'Follow' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull();
    expect(screen.queryByLabelText('Find people')).toBeNull();
    expect(screen.queryByText('Studio')).toBeNull();
  });

  it('follows and updates the follower count immediately', async () => {
    await render(<ProfileView userId="a1" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Follow' }));
    expect(await screen.findByRole('button', { name: 'Following' })).toBeOnTheScreen();
    expect(screen.getByText('43')).toBeOnTheScreen();
    expect(svc.setFollowing).toHaveBeenCalledWith('a1', true);
  });
});

describe('ProfileView – errors', () => {
  it('shows an error with a retry button', async () => {
    svc.getProfile.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(listenerProfile);
    await render(<ProfileView userId="u1" />);
    expect(await screen.findByText('Could not load this profile.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Taha')).toBeOnTheScreen();
  });
});