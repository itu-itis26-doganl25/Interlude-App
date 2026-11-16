import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import UserSearchScreen from '@/app/user-search';
import { userService } from '@/services';
import { makeUser } from '../helpers/fixtures';
import { mockRouter } from '../helpers/mockRouter';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  userService: { searchUsers: jest.fn() },
}));

const svc = userService as jest.Mocked<typeof userService>;
const box = () => screen.getByPlaceholderText('Search people');

describe('User search screen', () => {
  it('shows a hint before typing', async () => {
    await render(<UserSearchScreen />);
    expect(screen.getByText('Search for listeners and artists.')).toBeOnTheScreen();
  });

  it('lists matching people', async () => {
    svc.searchUsers.mockResolvedValue([makeUser({ id: 'u7', displayName: 'caner' })]);
    await render(<UserSearchScreen />);
    await fireEvent.changeText(box(), 'can');
    expect(await screen.findByText('caner')).toBeOnTheScreen();
    expect(svc.searchUsers).toHaveBeenCalledWith('can');
  });

  it('shows an empty state', async () => {
    svc.searchUsers.mockResolvedValue([]);
    await render(<UserSearchScreen />);
    await fireEvent.changeText(box(), 'zzz');
    expect(await screen.findByText('No people found.')).toBeOnTheScreen();
  });

  it('shows an error', async () => {
    svc.searchUsers.mockRejectedValue(new Error('x'));
    await render(<UserSearchScreen />);
    await fireEvent.changeText(box(), 'can');
    expect(await screen.findByText('Search failed. Please try again.')).toBeOnTheScreen();
  });

  it('opens a person’s profile', async () => {
    svc.searchUsers.mockResolvedValue([makeUser({ id: 'u7', displayName: 'caner' })]);
    await render(<UserSearchScreen />);
    await fireEvent.changeText(box(), 'can');
    await fireEvent.press(await screen.findByText('caner'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'u7' } });
  });
});