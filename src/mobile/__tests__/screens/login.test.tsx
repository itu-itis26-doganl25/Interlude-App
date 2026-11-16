import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from '@/app/(auth)/login';
import { AuthError } from '@/services';
import { mockUseAuth } from '../helpers/auth';

jest.mock('@/providers/AuthProvider');

const email = () => screen.getByPlaceholderText('you@example.com');
const password = () => screen.getByPlaceholderText('At least 8 characters');

describe('Login / Sign Up screen', () => {
  it('starts in log-in mode without the sign-up fields', async () => {
    mockUseAuth();
    await render(<LoginScreen />);
    expect(screen.getByRole('button', { name: 'Log in' })).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('How others will see you')).toBeNull();
    expect(screen.queryByText('I want to join as')).toBeNull();
  });

  it('switches to sign-up mode', async () => {
    mockUseAuth();
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
    expect(screen.getByPlaceholderText('How others will see you')).toBeOnTheScreen();
    expect(screen.getByText('I want to join as')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeOnTheScreen();
  });

  it('validates empty fields without calling the service', async () => {
    const auth = mockUseAuth();
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeOnTheScreen();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format', async () => {
    const auth = mockUseAuth();
    await render(<LoginScreen />);
    await fireEvent.changeText(email(), 'not-an-email');
    await fireEvent.changeText(password(), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('logs in with a trimmed email', async () => {
    const auth = mockUseAuth();
    await render(<LoginScreen />);
    await fireEvent.changeText(email(), '  taha@test.com  ');
    await fireEvent.changeText(password(), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(auth.login).toHaveBeenCalledWith({ email: 'taha@test.com', password: 'password123' }),
    );
  });

  it('shows the service error message', async () => {
    mockUseAuth({
      login: jest.fn().mockRejectedValue(new AuthError('INVALID_CREDENTIALS', 'Incorrect email or password.')),
    });
    await render(<LoginScreen />);
    await fireEvent.changeText(email(), 'taha@test.com');
    await fireEvent.changeText(password(), 'wrong-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Incorrect email or password.')).toBeOnTheScreen();
  });

  it('shows a generic message for unexpected errors', async () => {
    mockUseAuth({ login: jest.fn().mockRejectedValue(new Error('boom')) });
    await render(<LoginScreen />);
    await fireEvent.changeText(email(), 'taha@test.com');
    await fireEvent.changeText(password(), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
  });

  it('validates the display name when signing up', async () => {
    const auth = mockUseAuth();
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
    await fireEvent.changeText(screen.getByPlaceholderText('How others will see you'), 'T');
    await fireEvent.changeText(email(), 'taha@test.com');
    await fireEvent.changeText(password(), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Display name must be at least 2 characters.')).toBeOnTheScreen();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('signs up as a listener by default', async () => {
    const auth = mockUseAuth();
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
    await fireEvent.changeText(screen.getByPlaceholderText('How others will see you'), 'Taha');
    await fireEvent.changeText(email(), 'taha@test.com');
    await fireEvent.changeText(password(), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'taha@test.com',
        password: 'password123',
        displayName: 'Taha',
        role: 'listener',
      }),
    );
  });

  it('signs up as a musician when selected', async () => {
    const auth = mockUseAuth();
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Musician' }));
    await fireEvent.changeText(screen.getByPlaceholderText('How others will see you'), 'Taha');
    await fireEvent.changeText(email(), 'taha@test.com');
    await fireEvent.changeText(password(), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ role: 'musician' })));
  });

  it('clears errors when switching modes', async () => {
    mockUseAuth();
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
    expect(screen.queryByText('Enter a valid email address.')).toBeNull();
  });
});