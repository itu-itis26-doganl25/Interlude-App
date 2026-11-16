import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import ConnectionsScreen from '@/app/connections';
import { userService } from '@/services';
import { makeUser } from '../helpers/fixtures';
import { mockRouter } from '../helpers/mockRouter';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  userService: { getConnections: jest.fn() },
}));

const svc = userService as jest.Mocked<typeof userService>;

beforeEach(() => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ userId: 'u1', kind: 'followers' });
});

describe('Connections screen', () => {
  it('lists followers of the given user', async () => {
    svc.getConnections.mockResolvedValue([makeUser({ id: 'u7', displayName: 'caner' })]);
    await render(<ConnectionsScreen />);
    expect(await screen.findByText('caner')).toBeOnTheScreen();
    expect(svc.getConnections).toHaveBeenCalledWith('u1', 'followers');
  });

  it('requests the following list when asked', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ userId: 'u1', kind: 'following' });
    svc.getConnections.mockResolvedValue([]);
    await render(<ConnectionsScreen />);
    await screen.findByText('Nobody here yet.');
    expect(svc.getConnections).toHaveBeenCalledWith('u1', 'following');
  });

  it('shows an empty state', async () => {
    svc.getConnections.mockResolvedValue([]);
    await render(<ConnectionsScreen />);
    expect(await screen.findByText('Nobody here yet.')).toBeOnTheScreen();
  });

  it('shows an error', async () => {
    svc.getConnections.mockRejectedValue(new Error('x'));
    await render(<ConnectionsScreen />);
    expect(await screen.findByText('Could not load this list.')).toBeOnTheScreen();
  });

  it('opens a person’s profile', async () => {
    svc.getConnections.mockResolvedValue([makeUser({ id: 'u7', displayName: 'caner' })]);
    await render(<ConnectionsScreen />);
    await fireEvent.press(await screen.findByText('caner'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'u7' } });
  });
});