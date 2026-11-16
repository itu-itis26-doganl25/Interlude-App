import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import StudioScreen from '@/app/studio';
import { studioService } from '@/services';
import { makeAnalytics } from '../helpers/fixtures';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  studioService: { getAnalytics: jest.fn() },
}));

const svc = studioService as jest.Mocked<typeof studioService>;

beforeEach(() => {
  svc.getAnalytics.mockResolvedValue(makeAnalytics());
});

describe('Studio screen', () => {
  it('loads the 7-day overview by default', async () => {
    await render(<StudioScreen />);
    expect(await screen.findByText('Total plays')).toBeOnTheScreen();
    expect(svc.getAnalytics).toHaveBeenCalledWith('7d');
    expect(screen.getByRole('tab', { name: '7D' })).toBeSelected();
  });

  it('shows the four metric cards with their changes', async () => {
    await render(<StudioScreen />);
    await screen.findByText('Total plays');
    expect(screen.getByText('Unique listeners')).toBeOnTheScreen();
    expect(screen.getByText('New followers')).toBeOnTheScreen();
    expect(screen.getByText('Avg. listened')).toBeOnTheScreen();
    expect(screen.getByText('3K')).toBeOnTheScreen();
    expect(screen.getByText('▲ 20.0%')).toBeOnTheScreen();
    expect(screen.getByText('68%')).toBeOnTheScreen();
  });

  it('shows the chart and its date range', async () => {
    await render(<StudioScreen />);
    expect(await screen.findByText('Plays over time')).toBeOnTheScreen();
    expect(screen.getByText('Nov 10')).toBeOnTheScreen();
    expect(screen.getByText('Nov 11')).toBeOnTheScreen();
  });

  it('shows the breakdown lists', async () => {
    await render(<StudioScreen />);
    await screen.findByText('Top songs');
    expect(screen.getByText('Midnight Static')).toBeOnTheScreen();
    expect(screen.getByText('Album performance')).toBeOnTheScreen();
    expect(screen.getByText('Static Dreams')).toBeOnTheScreen();
    expect(screen.getByText('Live rooms')).toBeOnTheScreen();
    expect(screen.getByText('room plays')).toBeOnTheScreen();
    expect(screen.getByText('Glass Horizon')).toBeOnTheScreen();
    expect(screen.getByText('Listener countries')).toBeOnTheScreen();
    expect(screen.getByText('Turkey')).toBeOnTheScreen();
  });

  it('reloads when another range is selected', async () => {
    await render(<StudioScreen />);
    await screen.findByText('Total plays');
    await fireEvent.press(screen.getByRole('tab', { name: '30D' }));
    expect(svc.getAnalytics).toHaveBeenCalledWith('30d');
    expect(screen.getByRole('tab', { name: '30D' })).toBeSelected();
  });

  it('explains that uploading is not available yet', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<StudioScreen />);
    await screen.findByText('Total plays');
    await fireEvent.press(screen.getByRole('button', { name: /Upload song/ }));
    expect(spy).toHaveBeenCalledWith('Upload song', expect.any(String));
    spy.mockRestore();
  });

  it('shows an error and recovers on retry', async () => {
    svc.getAnalytics.mockReset();
    svc.getAnalytics.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(makeAnalytics());
    await render(<StudioScreen />);
    expect(await screen.findByText('Could not load analytics.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Total plays')).toBeOnTheScreen();
  });
});