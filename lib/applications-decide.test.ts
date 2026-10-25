import { describe, expect, it } from 'vitest';
import { DECISION_MESSAGE_MAX, parseDecision, parseDecisionChoice, parseNote } from './applications-decide';

describe('decisions and notes', () => {
  it('parses a decision or a move to social', () => {
    expect(parseDecision({ status: 'accepted' })).toEqual({ ok: true, value: { kind: 'status', status: 'accepted' } });
    expect(parseDecision({ status: 'declined' })).toMatchObject({ ok: true });
    expect(parseDecision({ path: 'social' })).toEqual({ ok: true, value: { kind: 'path', path: 'social' } });
    expect(parseDecision({ status: 'pending' })).toMatchObject({ ok: false });
    expect(parseDecision({ path: 'raider' })).toMatchObject({ ok: false });
    expect(parseDecision(null)).toMatchObject({ ok: false });
  });

  it('parses a note', () => {
    expect(parseNote({ body: '  Logs look fine. ' })).toEqual({ ok: true, body: 'Logs look fine.' });
    expect(parseNote({ body: '   ' })).toMatchObject({ ok: false, error: /Write/ });
    expect(parseNote({ body: 'x'.repeat(1001) })).toMatchObject({ ok: false, error: /1000/ });
  });

  it('parses a decision message and Accept as', () => {
    expect(parseDecision({ status: 'declined', message: { kind: 'none' } })).toEqual({ ok: true, value: { kind: 'status', status: 'declined', message: { kind: 'none' } } });
    expect(parseDecision({ status: 'accepted', acceptAs: 'social' })).toEqual({ ok: true, value: { kind: 'status', status: 'accepted', acceptAs: 'social' } });
    expect(parseDecisionChoice('declined', { message: { kind: 'standard' } })).toEqual({ ok: true, value: { message: { kind: 'standard' } } });
    expect(parseDecisionChoice('declined', { message: { kind: 'custom', text: '  Line one\nLine two \n' } })).toEqual({ ok: true, value: { message: { kind: 'custom', text: 'Line one\nLine two' } } });
    expect(parseDecisionChoice('accepted', { acceptAs: 'raider' })).toEqual({ ok: true, value: { acceptAs: 'raider' } });
    expect(parseDecisionChoice('accepted', {})).toEqual({ ok: true, value: {} });
  });

  it.each([
    ['message on Accept', 'accepted', { message: { kind: 'standard' } }],
    ['acceptAs on Decline', 'declined', { acceptAs: 'social' }],
    ['an unknown kind', 'declined', { message: { kind: 'polite' } }],
    ['an unknown acceptAs', 'accepted', { acceptAs: 'officer' }],
    ['a null acceptAs', 'accepted', { acceptAs: null }],
    ['a string message', 'declined', { message: 'Sorry' }],
    ['an array message', 'declined', { message: [] }],
    ['a number message', 'declined', { message: 3 }],
    ['a null message', 'declined', { message: null }],
    ['text with standard', 'declined', { message: { kind: 'standard', text: 'Hi' } }],
    ['empty text with none', 'declined', { message: { kind: 'none', text: '' } }],
    ['custom without text', 'declined', { message: { kind: 'custom' } }],
    ['custom with empty text', 'declined', { message: { kind: 'custom', text: '' } }],
    ['custom with whitespace text', 'declined', { message: { kind: 'custom', text: ' \n\t ' } }],
    ['custom with non-string text', 'declined', { message: { kind: 'custom', text: 42 } }],
  ] as const)('refuses %s', (_name, status, body) => {
    expect(parseDecisionChoice(status, body)).toEqual({ ok: false, error: expect.any(String) });
    expect(parseDecision({ status, ...body })).toEqual({ ok: false, error: expect.any(String) });
  });

  it('counts custom text in code points after trimming', () => {
    const custom = (text: string) => parseDecisionChoice('declined', { message: { kind: 'custom', text } });
    // Each emoji is one code point but two UTF-16 units.
    expect(custom('\u{1F600}'.repeat(DECISION_MESSAGE_MAX))).toMatchObject({ ok: true });
    expect(custom(`  ${'x'.repeat(DECISION_MESSAGE_MAX)}  `)).toMatchObject({ ok: true });
    expect(custom('\u{1F600}'.repeat(DECISION_MESSAGE_MAX + 1))).toEqual({ ok: false, error: 'Keep the message to 2,000 characters.' });
    expect(custom('x'.repeat(DECISION_MESSAGE_MAX + 1))).toMatchObject({ ok: false });
  });
});
