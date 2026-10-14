import { describe, expect, it } from 'vitest';
import { APPLY_GATE, APPLY_LINKS, EXPECTATIONS, FORM, NEEDS_SECTION, NEXT_STEPS, QUESTIONS, RECRUITMENT_HEAD, SUBMITTED } from './recruitment';

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
    expect(NEXT_STEPS.steps).toEqual([
      "You'll hear back from us within a few days.",
      "Then we'll have a short chat in Discord.",
      'New raiders start with a two-week trial.',
    ]);
  });

  it('uses the approved Apply box, Apply card and questions strip', () => {
    expect(RECRUITMENT_HEAD.aside).toEqual({ label: 'Apply', text: 'We read every application and respond within a few days.' });
    expect(APPLY_LINKS.raider.line).toBe('Apply for a raid spot with your logs and availability.');
    expect(APPLY_LINKS.social.line).toBe('Not raiding? You can also apply as a social member.');
    expect(QUESTIONS).toEqual({ title: 'Questions first?', text: 'Ask an officer in our Discord.', button: 'Join Discord' });
  });

  it('drops the old side box, intro and Not raiding box', () => {
    const text = everything([RECRUITMENT_HEAD, APPLY_LINKS, NEXT_STEPS, QUESTIONS]);
    for (const phrase of ['Right now', 'Jump to the form', 'Not raiding?"', 'Pick a path']) expect(text).not.toContain(phrase);
  });

  it('keeps removed or false claims off the public recruitment copy', () => {
    const banned = ['#recruitment', 'full loot', 'claims it', 'picks it up', 'lockout', 'None of this is unusual', 'fifteen minutes', 'straight answer'];
    const text = everything([RECRUITMENT_HEAD, NEEDS_SECTION, EXPECTATIONS, APPLY_LINKS, NEXT_STEPS, QUESTIONS, SUBMITTED]).toLowerCase();
    for (const phrase of banned) expect(text).not.toContain(phrase.toLowerCase());
  });

  it('keeps counts, quips and behind-the-scenes talk off the application form and sign-in step', () => {
    const banned = ['#recruitment', 'the 40', 'six questions', 'two questions', 'picks it up', 'waiting on an officer', 'claims it', 'deaths avoided', 'honest beats', 'tbd', 'officers pick', 'so an officer'];
    const text = everything([FORM, APPLY_GATE]).toLowerCase();
    for (const phrase of banned) expect(text).not.toContain(phrase);
  });

  it('sends questions to an officer in the Discord', () => {
    for (const m of [FORM.tooMany, FORM.duplicate, FORM.duplicateAccount]) expect(m).toContain('an officer in our Discord');
  });

  it('keeps the stored availability answers as written', () => {
    expect(FORM.availabilityOptions).toEqual(['Both nights', 'One of them', 'Neither']);
  });
});
