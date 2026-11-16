import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { authService } from '@/services';
import { makeUser } from '../helpers/fixtures';
import { deferred } from '../helpers/deferred';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  authService: {
    login: jest.fn(),
    signUp: jest.fn(),
    logout: jest.fn(),
    deleteAccount: jest.fn(),
    restoreSession: jest.fn(),
  },
}));

const svc = authService as jest.Mocked<typeof authService>;
const session = { user: makeUser(), accessToken: 'token' };
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const creds = { email: 'taha@test.com', password: 'password123' };

beforeEach(() => {
  svc.restoreSession.mockResolvedValue(null);
  svc.logout.mockResolvedValue(undefined);
  svc.deleteAccount.mockResolvedValue(undefined);
});

describe('AuthProvider', () => {
  it('starts as loading, then becomes unauthenticated without a stored session', async () => {
    const d = deferred<typeof session | null>();
    svc.restoreSession.mockReturnValue(d.promise);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe('loading');
    await act(async () => {
      d.resolve(null);
    });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('restores a stored session on start', async () => {
    svc.restoreSession.mockResolvedValue(session);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(session.user);
  });

  it('falls back to unauthenticated if restoring fails', async () => {
    svc.restoreSession.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
  });

  it('logs in and exposes the user', async () => {
    svc.login.mockResolvedValue(session);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await act(async () => {
      await result.current.login(creds);
    });
    expect(svc.login).toHaveBeenCalledWith(creds);
    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(session.user);
  });

  it('rethrows login errors and stays unauthenticated', async () => {
    svc.login.mockRejectedValue(new Error('nope'));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await act(async () => {
      await expect(result.current.login(creds)).rejects.toThrow('nope');
    });
    expect(result.current.status).toBe('unauthenticated');
  });

  it('signs up and authenticates', async () => {
    svc.signUp.mockResolvedValue(session);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await act(async () => {
      await result.current.signUp({ ...creds, displayName: 'Taha', role: 'listener' });
    });
    expect(result.current.status).toBe('authenticated');
  });

  it('logs out', async () => {
    svc.restoreSession.mockResolvedValue(session);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    await act(async () => {
      await result.current.logout();
    });
    expect(svc.logout).toHaveBeenCalled();
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });

  it('deletes the account and signs out', async () => {
    svc.restoreSession.mockResolvedValue(session);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    await act(async () => {
      await result.current.deleteAccount();
    });
    expect(svc.deleteAccount).toHaveBeenCalled();
    expect(result.current.status).toBe('unauthenticated');
  });

  it('keeps the session if deleting the account fails', async () => {
    svc.restoreSession.mockResolvedValue(session);
    svc.deleteAccount.mockRejectedValue(new Error('server'));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    await act(async () => {
      await expect(result.current.deleteAccount()).rejects.toThrow('server');
    });
    expect(result.current.status).toBe('authenticated');
  });
});

describe('useAuth', () => {
  it('throws when used outside the provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useAuth())).rejects.toThrow('useAuth must be used inside <AuthProvider>');
    spy.mockRestore();
  });
});