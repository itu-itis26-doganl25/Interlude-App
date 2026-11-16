import { formatCount, formatDuration } from '@/utils/format';

describe('formatDuration', () => {
  it('formats milliseconds as m:ss', () => {
    expect(formatDuration(214000)).toBe('3:34');
    expect(formatDuration(5000)).toBe('0:05');
    expect(formatDuration(60000)).toBe('1:00');
  });
});

describe('formatCount', () => {
  it('leaves small numbers alone', () => {
    expect(formatCount(999)).toBe('999');
  });
  it('abbreviates thousands and millions', () => {
    expect(formatCount(1000)).toBe('1K');
    expect(formatCount(1500)).toBe('1.5K');
    expect(formatCount(1_240_000)).toBe('1.2M');
    expect(formatCount(2_000_000)).toBe('2M');
  });
});