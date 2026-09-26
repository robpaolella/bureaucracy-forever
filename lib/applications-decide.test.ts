import { describe, expect, it } from 'vitest';
import { parseDecision, parseNote } from './applications-decide';

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
});
