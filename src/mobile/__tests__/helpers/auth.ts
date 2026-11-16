import { useAuth } from '@/providers/AuthProvider';
import { makeUser } from './fixtures';

export function mockUseAuth(overrides: Record<string, unknown> = {}) {
  const value = {
    status: 'authenticated',
    user: makeUser(),
    login: jest.fn().mockResolvedValue(undefined),
    signUp: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  (useAuth as jest.Mock).mockReturnValue(value);
  return value;
}