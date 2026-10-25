import { describe, expect, it } from 'vitest';
import { decisionDm } from '@/content/dm-templates';

// Robert's approved wording, 2026-10-24 (SYNC-SPEC §4 Decision request).
describe('decision messages', () => {
  it('tells a raider their trial starts today', () => {
    expect(decisionDm('raider', 'Sample Character')).toBe(
      'Your application to Bureaucracy for Sample Character was accepted. Your two-week trial starts today. You now have the Guild Member role; the raid calendar and roster are on https://www.bureauguild.com. Welcome aboard.',
    );
  });

  it('welcomes a social member without promising a trial', () => {
    expect(decisionDm('social', 'Sample Character')).toBe(
      'Your application to Bureaucracy for Sample Character was accepted as a social member. You now have the Guild Member role. Welcome aboard.',
    );
  });

  it('keeps the decline unchanged', () => {
    expect(decisionDm('declined', 'Sample Character')).toBe(
      "Thanks for applying to Bureaucracy with Sample Character. We're not able to take you on right now. You're welcome to stay in the Discord and apply again later; officers will say if anything changes.",
    );
  });
});
