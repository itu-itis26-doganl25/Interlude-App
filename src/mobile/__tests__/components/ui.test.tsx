import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';

describe('Button', () => {
  it('renders its title and handles presses', async () => {
    const onPress = jest.fn();
    await render(<Button title="Log in" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while loading and hides the title', async () => {
    const onPress = jest.fn();
    await render(<Button title="Log in" onPress={onPress} loading />);
    expect(screen.queryByText('Log in')).toBeNull();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('supports the danger variant', async () => {
    await render(<Button title="Delete account" variant="danger" onPress={jest.fn()} />);
    expect(screen.getByText('Delete account')).toBeOnTheScreen();
  });
});

describe('TextField', () => {
  it('shows the label and error', async () => {
    await render(<TextField label="Email" error="Enter a valid email address." placeholder="you@example.com" />);
    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
  });

  it('forwards text changes', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" placeholder="you@example.com" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    expect(onChangeText).toHaveBeenCalledWith('a@b.com');
  });

  it('toggles password visibility', async () => {
    await render(<TextField label="Password" placeholder="pw" secureTextEntry />);
    expect(screen.getByPlaceholderText('pw').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByText('Show'));
    expect(screen.getByPlaceholderText('pw').props.secureTextEntry).toBe(false);
    expect(screen.getByText('Hide')).toBeOnTheScreen();
  });

  it('has no show/hide toggle for normal fields', async () => {
    await render(<TextField label="Email" placeholder="e" />);
    expect(screen.queryByText('Show')).toBeNull();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'a', label: 'First' },
    { value: 'b', label: 'Second' },
  ];

  it('marks the active option as selected', async () => {
    await render(<SegmentedControl options={options} value="b" onChange={jest.fn()} />);
    expect(screen.getByRole('tab', { name: 'Second' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'First' })).not.toBeSelected();
  });

  it('calls onChange with the pressed value', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl options={options} value="a" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Second' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('SearchBar', () => {
  it('shows a clear button only when there is text', async () => {
    const { rerender } = await render(<SearchBar value="" onChangeText={jest.fn()} />);
    expect(screen.queryByLabelText('Clear search')).toBeNull();
    await rerender(<SearchBar value="nova" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('Clear search')).toBeOnTheScreen();
  });

  it('clears the text', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="nova" onChangeText={onChangeText} />);
    await fireEvent.press(screen.getByLabelText('Clear search'));
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('reports typing', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="" onChangeText={onChangeText} placeholder="Search" />);
    await fireEvent.changeText(screen.getByPlaceholderText('Search'), 'x');
    expect(onChangeText).toHaveBeenCalledWith('x');
  });
});

describe('Avatar', () => {
  it('shows the uppercase initial when there is no image', async () => {
    await render(<Avatar uri={null} name="taha" seed="u1" size={40} />);
    expect(screen.getByText('T')).toBeOnTheScreen();
  });

  it('falls back to "?" for an empty name', async () => {
    await render(<Avatar uri={null} name="  " seed="u1" size={40} />);
    expect(screen.getByText('?')).toBeOnTheScreen();
  });

  it('does not show an initial when an image is given', async () => {
    await render(<Avatar uri="https://example.com/a.png" name="taha" seed="u1" size={40} />);
    expect(screen.queryByText('T')).toBeNull();
  });
});