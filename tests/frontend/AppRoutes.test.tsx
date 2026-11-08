import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../src/frontend/src/app/AppRoutes';
import { SessionProvider } from '../../src/frontend/src/auth/SessionContext';
import type { AccountRole, Session } from '../../src/frontend/src/auth/SessionContext';

function openAt(path: string, role: AccountRole | null = 'listener') {
  const initialValue: Session = role
    ? { status: 'authenticated', role, userId: 'test' }
    : { status: 'guest' };
  return render(
    <SessionProvider initialValue={initialValue}>
      <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
    </SessionProvider>,
  );
}

describe('shared layout and routing (FR-01)', () => {
  it('renders header, navigation and reserved player bar', () => {
    openAt('/');
    expect(screen.getByRole('heading', { name: /find your rhythm/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Music player' })).toBeInTheDocument();
  });

  it.each([
    ['/catalogue', 'Music catalogue'],
    ['/rooms', 'Listening rooms'],
    ['/rooms/example-room', 'Inside a room'],
    ['/profile', 'My profile'],
    ['/playlists', 'My playlists'],
    ['/playlists/id', 'Playlist details'],
    ['/profile/followers', 'Followers'],
    ['/profile/following', 'Following'],
    ['/users/id', 'User profile'],
    ['/musicians/id/report', 'Report copyright concern'],
    ['/tracks/abc', 'Track details'],
    ['/albums/abc', 'Album details'],
  ])('listener can navigate to %s', (path, title) => {
    openAt(path);
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
  });

  it('preserves search parameters', () => {
    openAt('/search?q=indie%20rock');
    expect(screen.getByText(/Searching for “indie rock”/i)).toBeInTheDocument();
  });

  it('hides musician dashboard from listener navigation and redirects direct access', () => {
    openAt('/dashboard', 'listener');
    expect(screen.getByRole('heading', { name: /find your rhythm/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Musician dashboard' })).not.toBeInTheDocument();
  });

  it('allows musician dashboard and shows its navigation link', () => {
    openAt('/dashboard', 'musician');
    expect(screen.getByRole('heading', { name: 'Musician dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Musician dashboard' })).toBeInTheDocument();
  });

  it('exposes admin reports only to admin', () => {
    openAt('/admin/reports', 'admin');
    expect(screen.getByRole('heading', { name: 'Copyright reports', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Copyright reports' })).toBeInTheDocument();
  });

  it('redirects a listener away from admin reports', () => {
    openAt('/admin/reports', 'listener');
    expect(screen.getByRole('heading', { name: /find your rhythm/i })).toBeInTheDocument();
  });

  it('redirects guests to the login page for protected routes', () => {
    openAt('/rooms', null);
    expect(screen.getByRole('heading', { name: 'Sign in', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument();
  });

  it('shows registration page to guests', () => {
    openAt('/register', null);
    expect(screen.getByRole('heading', { name: 'Create an account', level: 1 })).toBeInTheDocument();
  });

  it('shows a fallback for unknown routes', () => {
    openAt('/unknown-page');
    expect(screen.getByRole('heading', { name: /that track is missing/i })).toBeInTheDocument();
  });
});
