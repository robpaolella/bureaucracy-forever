import { describe, expect, it } from 'vitest';
import { APPLY_LINKS, EXPECTATIONS, NEEDS_SECTION, NEXT_STEPS, RECRUITMENT_HEAD, SUBMITTED } from './recruitment';

const everything = (o: unknown) => JSON.stringify(o);

describe('recruitment copy', () => {
  it('uses the approved head, expectations and received-page text', () => {
    expect(RECRUITMENT_HEAD.title).toBe('Join a raid team built to compete');
    expect(RECRUITMENT_HEAD.lede).toBe(
      "The table below shows the classes and specs we need most. If your spec is closed and you're an exceptional player, we still want to hear from you.",
    );
    expect(EXPECTATIONS.items.map((i) => i.title)).toEqual([
      'Both progression nights',
      'Come prepared',
      'In Discord for every raid',
      'Two-week trial',
    ]);
    expect(SUBMITTED.title).toBe('Your application is in');
    expect(SUBMITTED.body).toBe(
      "Thanks for applying. We'll get back to you on Discord within a few days. If you have a question in the meantime, ask an officer in our Discord.",
    );
  });

  it('has no notes under the needs table or the expectations', () => {
    expect(NEEDS_SECTION).not.toHaveProperty('note');
    expect(EXPECTATIONS).not.toHaveProperty('note');
  });

  it('says three things happen next', () => {
    expect(NEXT_STEPS.steps).toHaveLength(3);
  });

  it('keeps removed or false claims off the public recruitment copy', () => {
    const banned = ['#recruitment', 'full loot', 'claims it', 'picks it up', 'lockout', 'None of this is unusual', 'fifteen minutes', 'straight answer'];
    const text = everything([RECRUITMENT_HEAD, NEEDS_SECTION, EXPECTATIONS, APPLY_LINKS, NEXT_STEPS, SUBMITTED]).toLowerCase();
    for (const phrase of banned) expect(text).not.toContain(phrase.toLowerCase());
  });
});
