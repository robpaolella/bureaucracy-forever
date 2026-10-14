import { describe, expect, it } from 'vitest';
import { buildProblems } from './helper-problems';

const t = (s: number) => new Date(s * 1000);
const build = (over: Partial<Parameters<typeof buildProblems>[0]> = {}) =>
  buildProblems({ raidId: 'cm9xr2k4a0001', now: t(5000), rejections: [], pending: [], ...over });

describe('buildProblems', () => {
  it('answers empty lists for a raid with no problems', () => {
    expect(build()).toEqual({ formatVersion: 1, raid: 'cm9xr2k4a0001', generated: 5000, rejected: [], pending: [] });
  });

  it('lists a rejection with its code, the type and key it named, and when it arrived', () => {
    const { rejected } = build({
      rejections: [
        { opId: 'op_addon_0001', code: 'key-conflict', payload: { type: 'award', key: 'op_addon_0001', item: 18861 }, receivedAt: t(1000) },
        { opId: 'op_addon_0002', code: 'wrong-environment', payload: { type: 'void' }, receivedAt: t(1500) },
      ],
    });
    expect(rejected).toEqual([
      { id: 'op_addon_0001', code: 'key-conflict', type: 'award', key: 'op_addon_0001', at: 1000 },
      { id: 'op_addon_0002', code: 'wrong-environment', type: 'void', at: 1500 },
    ]);
  });

  it('echoes only plain short strings from a payload of any shape', () => {
    const long = 'x'.repeat(201);
    for (const payload of [null, 'text', 7, [], { type: 5, key: long }, { type: '', key: {} }]) {
      expect(build({ rejections: [{ opId: 'op_1', code: 'bad-record', payload, receivedAt: t(1) }] }).rejected).toEqual([{ id: 'op_1', code: 'bad-record', at: 1 }]);
    }
  });

  it('lists pending operations by their kind', () => {
    const { pending } = build({
      pending: [
        { opId: 'op_a', type: 'VOID', key: 'op_gone_0001', receivedAt: t(2000) },
        { opId: 'op_b', type: 'CONFIRM', key: 'op_gone_0002', receivedAt: t(2100) },
        { opId: 'op_c', type: 'NOT_CONFIRMED', key: 'op_gone_0003', receivedAt: t(2200) },
        { opId: 'op_d', type: 'REPLACE', key: 'op_gone_0004', receivedAt: t(2300) },
      ],
    });
    expect(pending.map((p) => [p.id, p.type, p.key, p.at])).toEqual([
      ['op_a', 'void', 'op_gone_0001', 2000],
      ['op_b', 'confirm', 'op_gone_0002', 2100],
      ['op_c', 'not-confirmed', 'op_gone_0003', 2200],
      ['op_d', 'replace', 'op_gone_0004', 2300],
    ]);
  });
});
