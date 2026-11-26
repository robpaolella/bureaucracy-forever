import { describe, expect, it } from 'vitest';
import { RESPONSE_NOTES } from '@/content/raid';
import { REASONS } from '@/lib/signup-rules';
import { webReason } from './signup-web-reason';

describe('webReason', () => {
  it('words the lock for the site, keeping the bot text unchanged', () => {
    expect(webReason(REASONS.locked)).toBe('Sign-ups are locked. Ask an officer if something changed.');
    expect(webReason(REASONS.locked)).toBe(RESPONSE_NOTES.locked);
    expect(REASONS.locked).toBe('Sign-ups are locked. Officers can still change answers on the web.');
  });
  it('leaves every other refusal alone', () => {
    for (const [key, reason] of Object.entries(REASONS)) if (key !== 'locked') expect(webReason(reason)).toBe(reason);
  });
});
