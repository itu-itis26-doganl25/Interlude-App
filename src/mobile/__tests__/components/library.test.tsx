import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterChips } from '@/components/library/FilterChips';

const options = [
  { value: 'songs', label: 'Songs' },
  { value: 'albums', label: 'Albums' },
];

describe('FilterChips', () => {
  it('marks the active chip as selected', async () => {
    await render(<FilterChips options={options} value="albums" onChange={jest.fn()} />);
    expect(screen.getByRole('tab', { name: 'Albums' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Songs' })).not.toBeSelected();
  });

  it('calls onChange with the pressed chip', async () => {
    const onChange = jest.fn();
    await render(<FilterChips options={options} value="songs" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Albums' }));
    expect(onChange).toHaveBeenCalledWith('albums');
  });
});