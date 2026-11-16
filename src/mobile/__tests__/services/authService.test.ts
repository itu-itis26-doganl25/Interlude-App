import { AuthError, getMockSessionUser, mockAuthService } from '@/services/authService';
import { settle } from '../helpers/timers';

beforeEach(async () => {
  jest.useFakeTimers();
  await settle(mockAuthService.logout());
});
afterEach(() => jest.useRealTimers());

const creds = { email: 'taha@test.com', password: 'password123' };

describe('mockAuthService', () => {
  it('logs in and returns a listener session by default', async () => {
    const session = await settle(mockAuthService.login(creds));
    expect(session.user).toMatchObject({ email: 'taha@test.com', displayName: 'taha', role: 'listener' });
    expect(session.accessToken).toBeTruthy();
  });

  it('gives the musician role when the email contains "musician"', async () => {
    const session = await settle(mockAuthService.login({ ...creds, email: 'musician@test.com' }));
    expect(session.user.role).toBe('musician');
  });

  it('rejects the demo wrong password with INVALID_CREDENTIALS', async () => {
    const p = settle(mockAuthService.login({ ...creds, password: 'wrong-password' }));
    await expect(p).rejects.toBeInstanceOf(AuthError);
    await expect(p).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('signs up with the given display name and role', async () => {
    const session = await settle(
      mockAuthService.signUp({ ...creds, displayName: 'Taha D', role: 'musician' }),
    );
    expect(session.user).toMatchObject({ displayName: 'Taha D', role: 'musician' });
  });

  it('rejects sign up with a taken email', async () => {
    const p = settle(
      mockAuthService.signUp({ email: 'taken@interlude.app', password: 'password123', displayName: 'X Y', role: 'listener' }),
    );
    await expect(p).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('restores the session only after a login', async () => {
    expect(await settle(mockAuthService.restoreSession())).toBeNull();
    await settle(mockAuthService.login(creds));
    expect((await settle(mockAuthService.restoreSession()))?.user.email).toBe('taha@test.com');
  });

  it('clears the session on logout', async () => {
    await settle(mockAuthService.login(creds));
    await settle(mockAuthService.logout());
    expect(await settle(mockAuthService.restoreSession())).toBeNull();
  });

  it('clears the session when the account is deleted', async () => {
    await settle(mockAuthService.login(creds));
    await settle(mockAuthService.deleteAccount());
    expect(await settle(mockAuthService.restoreSession())).toBeNull();
    expect(getMockSessionUser()).toBeNull();
  });

  it('exposes the logged-in user to other mock services', async () => {
    await settle(mockAuthService.login(creds));
    expect(getMockSessionUser()?.email).toBe('taha@test.com');
  });
});