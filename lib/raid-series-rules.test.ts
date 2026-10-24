import { describe, expect, it } from 'vitest';
import { parseSeriesInput, parseTemplateInput } from './raid-series-rules';

describe('template and series input', () => {
  it('stores exactly three requirement keys, converting the older four-number shape', () => {
    const base = { name: 'Molten Core', short: 'MC', size: 40, durationMin: 180 };
    const parsed = parseTemplateInput({ ...base, requirements: { tank: 4, healer: 12, dps: 24 } });
    expect(parsed.ok && parsed.value.requirements).toStrictEqual({ tank: 4, healer: 12, dps: 24 });
    const old = parseTemplateInput({ ...base, requirements: { tank: 4, healer: 12, melee: 10, ranged: 14 } });
    expect(old.ok && old.value.requirements).toStrictEqual({ tank: 4, healer: 12, dps: 24 });
    const mixed = parseTemplateInput({ ...base, requirements: { tank: 4, healer: 12, dps: 24, melee: 1, ranged: 1 } });
    expect(mixed.ok && mixed.value.requirements).toStrictEqual({ tank: 4, healer: 12, dps: 24 });
  });

  it('refuses negative, fractional and non-number requirements', () => {
    const base = { name: 'Molten Core', short: 'MC', size: 40, durationMin: 180 };
    for (const requirements of [{ tank: -4, healer: 20, dps: 24 }, { tank: 4, healer: 11.5, dps: 24.5 }, { tank: 4, healer: 12, dps: '24' }, { tank: 4, healer: 12 }]) {
      expect(parseTemplateInput({ ...base, requirements })).toEqual({ ok: false, error: 'Requirements are whole numbers from 0 to 40.' });
    }
  });

  it('requires the requirements to add up to the size', () => {
    const good = { name: 'Molten Core', short: 'MC', size: 40, durationMin: 180, requirements: { tank: 4, healer: 12, dps: 24 } };
    expect(parseTemplateInput(good)).toMatchObject({ ok: true, value: { active: true } });
    expect(parseTemplateInput({ ...good, requirements: { tank: 4, healer: 12, dps: 23 } })).toEqual({ ok: false, error: 'Tank, healer and DPS must add up to 40.' });
    expect(parseTemplateInput({ ...good, short: 'TOOLONGNAME' })).toMatchObject({ ok: false, error: /short/ });
    expect(parseTemplateInput({ ...good, durationMin: 100 })).toMatchObject({ ok: false, error: /quarter/ });
  });

  it('validates a series and fills the spec defaults', () => {
    const r = parseSeriesInput({ templateId: 't1', weekday: 4, startTime: '20:00', durationMin: 180 });
    expect(r).toMatchObject({ ok: true, value: { postAheadDays: 14, lockMinutesBefore: 120, horizonWeeks: 4, notes: '', active: true } });
    expect(parseSeriesInput({ templateId: 't1', weekday: 7, startTime: '20:00', durationMin: 180 })).toMatchObject({ ok: false, error: /weekday/ });
    expect(parseSeriesInput({ templateId: 't1', weekday: 4, startTime: '8pm', durationMin: 180 })).toMatchObject({ ok: false, error: /HH:MM/ });
    expect(parseSeriesInput({ templateId: '', weekday: 4, startTime: '20:00', durationMin: 180 })).toMatchObject({ ok: false, error: /template/ });
  });
});
