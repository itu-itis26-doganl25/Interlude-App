import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** Frontend-only state contract; auth owner must connect it to verified backend session. */
export type AccountRole = 'listener' | 'musician' | 'admin';
export type Session =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'authenticated'; role: AccountRole; userId: string };

type SessionContextValue = {
  session: Session;
  setSession: (next: Session) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function initialSession(): Session {
  // Explicit local preview only; NEVER an authentication mechanism.
  if (import.meta.env.DEV) {
    const role = import.meta.env.VITE_DEV_PREVIEW_ROLE;
    if (role === 'listener' || role === 'musician' || role === 'admin') {
      return { status: 'authenticated', role, userId: 'preview-only' };
    }
  }
  return { status: 'guest' };
}

export function SessionProvider({
  children,
  initialValue,
}: {
  children: ReactNode;
  initialValue?: Session;
}) {
  const [session, setSession] = useState<Session>(initialValue ?? initialSession);
  const value = useMemo(() => ({ session, setSession }), [session]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used under SessionProvider');
  return context;
}
