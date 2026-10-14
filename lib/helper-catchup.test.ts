import { describe, expect, it } from 'vitest';
import { buildCatchup, type CatchupInput } from './helper-catchup';

const t = (s: number) => new Date(s * 1000);
const award = (over: Partial<CatchupInput['awards'][number]>): CatchupInput['awards'][number] => ({
  id: 'cmaward0001', requestKey: 'op_addon_0001', bossId: 'lb_trash', itemId: 18861, characterName: 'Dee Holt', userId: 'u_dee', method: 'OPEN_ROLL', roll: 64, voidedAt: null,
  source: 'ADDON', confirmation: 'ANNOUNCED', confirmedAt: null, awardedAt: t(1000), createdAt: t(1010), practice: false, ...over,
});
const build = (awards: CatchupInput['awards'], pending: CatchupInput['pending'] = []) =>
  buildCatchup({ raidId: 'cm9xr2k4a0001', env: 'staging', now: t(5000), awards, pending });

describe('buildCatchup', () => {
  it('heads the tree like the snapshot and answers empty lists for an empty raid', () => {
    expect(build([])).toEqual({ formatVersion: 1, raid: 'cm9xr2k4a0001', env: 'staging', generated: 5000, awards: [], voids: [] });
  });

  it('carries an add-on award’s state and the time that state last changed', () => {
    const [announced, confirmed, notConfirmed] = build([
      award({}),
      award({ requestKey: 'op_addon_0002', confirmation: 'CONFIRMED', confirmedAt: t(1100) }),
      award({ requestKey: 'op_addon_0003', confirmation: 'NOT_CONFIRMED', confirmedAt: t(1200) }),
    ]).awards;
    expect([announced.state, announced.at]).toEqual(['announced', 1000]);
    expect([confirmed.state, confirmed.at]).toEqual(['confirmed', 1100]);
    expect([notConfirmed.state, notConfirmed.at]).toEqual(['not-confirmed', 1200]);
    expect(announced).toEqual({ key: 'op_addon_0001', boss: 'lb_trash', item: 18861, char: 'Dee Holt', user: 'u_dee', method: 'OPEN_ROLL', roll: 64, voided: false, state: 'announced', at: 1000 });
  });

  it('marks a by-hand award manual, with the baseline’s own key when it has none, and no practice flag', () => {
    const [byHand, keyed] = build([
      award({ id: 'cmhand0001', requestKey: null, source: 'LOOT_LOG', confirmation: 'CONFIRMED', awardedAt: null, createdAt: t(900) }),
      award({ requestKey: 'req_by_hand_0002', source: 'LOOT_LOG', createdAt: t(950) }),
    ]).awards;
    expect(byHand).toMatchObject({ key: 'site-cmhand0001', state: 'manual', at: 900 });
    expect(keyed).toMatchObject({ key: 'req_by_hand_0002', state: 'manual', at: 950 });
    expect('practice' in byHand).toBe(false);
  });

  it('keeps a voided award in the list with the state it had, and marks practice awards', () => {
    const [voided, practice] = build([
      award({ voidedAt: t(1300), confirmation: 'CONFIRMED', confirmedAt: t(1100) }),
      award({ requestKey: 'op_addon_0002', practice: true }),
    ]).awards;
    expect(voided).toMatchObject({ voided: true, state: 'confirmed', at: 1100 });
    expect(practice.practice).toBe(true);
  });

  it('lists pending voids and replaces as voids, with the reason only when there is one', () => {
    const { voids, awards } = build([], [
      { key: 'op_gone_0001', at: t(2000), payload: { type: 'void', reason: 'Wrong player' } },
      { key: 'op_gone_0002', at: t(2100), payload: { type: 'void', reason: null } },
      { key: 'op_gone_0003', at: t(2200), payload: { type: 'replace', award: {} } },
    ]);
    expect(awards).toEqual([]);
    expect(voids).toEqual([{ key: 'op_gone_0001', reason: 'Wrong player', at: 2000 }, { key: 'op_gone_0002', at: 2100 }, { key: 'op_gone_0003', at: 2200 }]);
  });
});
