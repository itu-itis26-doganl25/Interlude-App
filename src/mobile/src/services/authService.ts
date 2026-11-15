import type { User, UserRole } from '@/types/models';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpPayload extends LoginCredentials {
  displayName: string;
  role: UserRole;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}

export type AuthErrorCode = 'INVALID_CREDENTIALS' | 'EMAIL_TAKEN' | 'NETWORK' | 'UNKNOWN';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Contract the real REST implementation (WBS-14.3) must satisfy. */
export interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  signUp(payload: SignUpPayload): Promise<AuthSession>;
  logout(): Promise<void>;
  /** Called on app start; resolve null when there is no stored session. */
  restoreSession(): Promise<AuthSession | null>;
}

// ---------- Mock implementation ----------

const delay = (ms = 800) => new Promise<void>((r) => setTimeout(r, ms));

const makeSession = (email: string, displayName: string, role: UserRole): AuthSession => ({
  accessToken: 'mock-token',
  user: {
    id: 'user-1',
    email,
    displayName,
    avatarUrl: null,
    role,
    createdAt: new Date().toISOString(),
  },
});

let currentSession: AuthSession | null = null; // later: SecureStore / API token

export const mockAuthService: AuthService = {
  async login({ email, password }) {
    await delay();
    // Demo rule: password "wrong-password" simulates a failed login.
    if (password === 'wrong-password') {
      throw new AuthError('INVALID_CREDENTIALS', 'Incorrect email or password.');
    }
    const role: UserRole = email.toLowerCase().includes('musician') ? 'musician' : 'listener';
    currentSession = makeSession(email, email.split('@')[0], role);
    return currentSession;
  },

  async signUp({ email, displayName, role }) {
    await delay();
    if (email.toLowerCase() === 'taken@interlude.app') {
      throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    currentSession = makeSession(email, displayName, role);
    return currentSession;
  },

  async logout() {
    await delay(200);
    currentSession = null;
  },

  async restoreSession() {
    await delay(400);
    return currentSession;
  },
};