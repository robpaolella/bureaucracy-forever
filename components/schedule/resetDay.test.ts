import { describe, expect, it } from 'vitest';
import { resetDayLabel } from './resetDay';

// Tuesday 8:00 AM guild time (America/Los_Angeles, PDT) = 15:00 UTC.
const reset = new Date('2026-10-06T15:00:00Z');

describe('resetDayLabel', () => {
  it('names the guild day before the viewer zone is known', () => {
    expect(resetDayLabel(2, reset, null)).toBe('Tuesday ');
  });

  it('names the guild day when the viewer is on the same day', () => {
    expect(resetDayLabel(2, reset, 'America/Los_Angeles')).toBe('Tuesday ');
    expect(resetDayLabel(2, reset, 'Europe/London')).toBe('Tuesday ');
  });

  it('leaves the day to LocalTime when the reset is on another day for the viewer', () => {
    // 4:00 AM Wednesday in Auckland (NZDT).
    expect(resetDayLabel(2, reset, 'Pacific/Auckland')).toBe('');
  });
});
