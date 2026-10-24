import { describe, expect, it } from 'vitest';
import { INSTANCE_ERROR, parseSeriesInput, parseTemplateInput } from './raid-series-rules';

describe('template and series input', () => {
  it('keeps storing four requirement keys', () => {
    const parsed = parseTemplateInput({ name: 'Molten Core', short: 'MC', size: 40, durationMin: 180, requirements: { tank: 4, healer: 12, melee: 10, ranged: 14 } });
    expect(parsed).toMatchObject({ ok: true, value: { requirements: { tank: 4, healer: 12, melee: 10, ranged: 14 } } });
  });

  it('requires the requirements to add up to the size', () => {
    const good = { name: 'Molten Core', short: 'MC', size: 40, durationMin: 180, requirements: { tank: 4, healer: 12, melee: 10, ranged: 14 } };
    expect(parseTemplateInput(good)).toMatchObject({ ok: true, value: { active: true } });
    expect(parseTemplateInput({ ...good, requirements: { tank: 4, healer: 12, melee: 10, ranged: 13 } })).toMatchObject({ ok: false, error: /add up to 40/ });
    expect(parseTemplateInput({ ...good, short: 'TOOLONGNAME' })).toMatchObject({ ok: false, error: /short/ });
    expect(parseTemplateInput({ ...good, durationMin: 100 })).toMatchObject({ ok: false, error: /quarter/ });
  });

  it('reads the instance number: blank is not set, whole numbers above 0 save', () => {
    const good = { name: 'Onyxia', short: 'Ony', size: 40, durationMin: 60, requirements: { tank: 3, healer: 12, melee: 11, ranged: 14 } };
    const instance = (v: unknown) => parseTemplateInput({ ...good, instance: v });
    expect(instance(undefined)).toMatchObject({ ok: true, value: { instance: null } });
    for (const blank of [null, '', '  ']) expect(instance(blank)).toMatchObject({ ok: true, value: { instance: null } });
    expect(instance(249)).toMatchObject({ ok: true, value: { instance: 249 } });
    expect(instance(' 249 ')).toMatchObject({ ok: true, value: { instance: 249 } });
    for (const bad of ['24.9', 24.9, 0, '0', -5, '-5', 'abc', '0x10', '1e3', 2_147_483_648, true, {}]) {
      expect(instance(bad)).toEqual({ ok: false, error: INSTANCE_ERROR });
    }
  });

  it('validates a series and fills the spec defaults', () => {
    const r = parseSeriesInput({ templateId: 't1', weekday: 4, startTime: '20:00', durationMin: 180 });
    expect(r).toMatchObject({ ok: true, value: { postAheadDays: 14, lockMinutesBefore: 120, horizonWeeks: 4, notes: '', active: true } });
    expect(parseSeriesInput({ templateId: 't1', weekday: 7, startTime: '20:00', durationMin: 180 })).toMatchObject({ ok: false, error: /weekday/ });
    expect(parseSeriesInput({ templateId: 't1', weekday: 4, startTime: '8pm', durationMin: 180 })).toMatchObject({ ok: false, error: /HH:MM/ });
    expect(parseSeriesInput({ templateId: '', weekday: 4, startTime: '20:00', durationMin: 180 })).toMatchObject({ ok: false, error: /template/ });
  });
});
