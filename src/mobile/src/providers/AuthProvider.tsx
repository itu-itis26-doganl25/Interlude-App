import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService, LoginCredentials, SignUpPayload } from '@/services';
import type { User } from '@/types/models';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (c: LoginCredentials) => Promise<void>;
  signUp: (p: SignUpPayload) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    authService
      .restoreSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        setStatus(session ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => !cancelled && setStatus('unauthenticated'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Errors propagate to the caller (the screen) so it can show them.
  const login = useCallback(async (c: LoginCredentials) => {
    const session = await authService.login(c);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const signUp = useCallback(async (p: SignUpPayload) => {
    const session = await authService.signUp(p);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({ status, user, login, signUp, logout, deleteAccount }),
    [status, user, login, signUp, logout, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}