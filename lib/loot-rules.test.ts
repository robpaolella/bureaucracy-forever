import { describe, expect, it } from 'vitest';
import { RESERVES } from '@/content/reserves';
import {
  decideReserve,
  decideVoid,
  defaultMethodFor,
  draftPickFor,
  hrBlocked,
  isEligible,
  LOOT_LOG_METHODS,
  parseAwardInput,
  parseItemRef,
  parseWinLimit,
  pickUnavailable,
  REASONS,
  reserveHolders,
  reservesLockAt,
  resolveDrop,
  winLimitOf,
  type ActiveReserve,
  type ReserveContext,
  type ReserveRaid,
} from './loot-rules';

const startsAt = new Date('2026-10-16T03:00:00.000Z');
const now = new Date('2026-10-15T20:00:00.000Z');
const raid: ReserveRaid = { cancelled: false, startsAt, hasLootTable: true };
const member = { role: 'member' as const };
const ctx: ReserveContext = { response: 'accept', ownCharacterIds: ['c1', 'c2'], tableItemIds: new Set([100, 200, 300]), hrAwards: [] };
const pick = { characterId: 'c1', hr: 100, sr: 200 };

describe('reserve lock and eligibility', () => {
  it('locks two hours before the start', () => {
    expect(reservesLockAt(startsAt).toISOString()).toBe('2026-10-16T01:00:00.000Z');
  });

  it('counts only Accept and Tentative', () => {
    expect(isEligible('accept')).toBe(true);
    expect(isEligible('tentative')).toBe(true);
    expect(isEligible('absent')).toBe(false);
    expect(isEligible(null)).toBe(false);
    expect(isEligible(undefined)).toBe(false);
  });
});

describe('decideReserve', () => {
  it('accepts a valid pair, a single reserve and clearing both', () => {
    expect(decideReserve(member, raid, pick, ctx, now)).toEqual({ ok: true });
    expect(decideReserve(member, raid, { characterId: 'c2', hr: null, sr: 300 }, ctx, now)).toEqual({ ok: true });
    expect(decideReserve(member, raid, { characterId: 'c1', hr: null, sr: null }, ctx, now)).toEqual({ ok: true });
  });

  it.each([
    ['socials', { role: 'social' as const }, raid, pick, ctx, 403, REASONS.social],
    ['cancelled raids', member, { ...raid, cancelled: true }, pick, ctx, 409, REASONS.cancelled],
    ['raids without a loot table', member, { ...raid, hasLootTable: false }, pick, ctx, 409, REASONS.noTable],
    ['absent sign-ups', member, raid, pick, { ...ctx, response: 'absent' as const }, 409, REASONS.notEligible],
    ['unanswered sign-ups', member, raid, pick, { ...ctx, response: null }, 409, REASONS.notEligible],
    ["someone else's character", member, raid, { ...pick, characterId: 'x' }, ctx, 403, REASONS.notYourCharacter],
    ['items outside the table', member, raid, { ...pick, sr: 999 }, ctx, 409, REASONS.notInTable],
    ['the same item twice', member, raid, { ...pick, sr: 100 }, ctx, 409, REASONS.sameItem],
    ['an HR on an item already won through HR', member, raid, pick, { ...ctx, hrAwards: [{ characterId: 'c1', itemId: 100 }] }, 409, REASONS.hrReceived],
  ])('refuses %s', (_label, actor, r, input, c, status, reason) => {
    expect(decideReserve(actor, r, input, c, now)).toEqual({ ok: false, status, reason });
  });

  it('blocks SR on a previously won item, but allows another character to reserve it', () => {
    const won = { ...ctx, hrAwards: [{ characterId: 'c1', itemId: 100 }] };
    expect(decideReserve(member, raid, { characterId: 'c1', hr: 200, sr: 100 }, won, now)).toEqual({ ok: false, status: 409, reason: REASONS.hrReceived });
    expect(decideReserve(member, raid, { characterId: 'c2', hr: 100, sr: null }, won, now)).toEqual({ ok: true });
  });

  it('locks members out two hours before the start, but not an officer acting on the web', () => {
    const late = new Date('2026-10-16T01:00:00.000Z');
    expect(decideReserve(member, raid, pick, ctx, late)).toEqual({ ok: false, status: 409, reason: REASONS.locked });
    expect(decideReserve({ role: 'officer' }, raid, pick, ctx, late)).toMatchObject({ ok: false, reason: REASONS.locked });
    expect(decideReserve({ role: 'officer' }, raid, pick, ctx, late, true)).toEqual({ ok: true });
    expect(decideReserve({ role: 'officer' }, { ...raid, cancelled: true }, pick, ctx, late, true)).toMatchObject({ reason: REASONS.cancelled });
    expect(decideReserve(member, raid, pick, ctx, late, true)).toMatchObject({ ok: false, reason: REASONS.locked });
  });

  it('lets a member who is no longer eligible clear their reserves before the lock', () => {
    const absent = { ...ctx, response: 'absent' as const };
    expect(decideReserve(member, raid, { characterId: 'c1', hr: null, sr: null }, absent, now)).toEqual({ ok: true });
    expect(decideReserve(member, raid, { characterId: 'c1', hr: null, sr: null }, absent, new Date('2026-10-16T02:00:00.000Z'))).toMatchObject({ reason: REASONS.locked });
  });
});

describe('blocked tier items', () => {
  const blocked = { ...ctx, blockedItemIds: new Set([100]) };
  const existing = { characterId: 'c1', itemId: 100, kind: 'HR' as const };

  it.each(['member', 'officer'] as const)('refuses new HR and SR for %s, locked or unlocked', (role) => {
    for (const time of [now, startsAt]) for (const input of [pick, { ...pick, hr: 200, sr: 100 }]) {
      expect(decideReserve({ role }, raid, input, blocked, time, true)).toMatchObject({
        ok: false, reason: role === 'member' && time === startsAt ? REASONS.locked : REASONS.itemBlocked,
      });
    }
  });

  it.each(['member', 'officer'] as const)('keeps a blocked reserve while %s changes the other slot', (role) => {
    const context = { ...blocked, existingReserves: [existing] };
    expect(decideReserve({ role }, raid, { ...pick, sr: 300 }, context, role === 'officer' ? startsAt : now, true)).toEqual({ ok: true });
    // Moving a locked raid back outside the lock does not invalidate the kept reserve.
    expect(decideReserve({ role }, { ...raid, startsAt: new Date('2027-01-01') }, pick, context, startsAt, true)).toEqual({ ok: true });
    expect(decideReserve({ role }, raid, { ...pick, characterId: 'c2' }, context, now, true)).toMatchObject({ reason: REASONS.itemBlocked });
    expect(decideReserve({ role }, raid, { ...pick, hr: 200, sr: 100 }, context, now, true)).toMatchObject({ reason: REASONS.itemBlocked });
  });

  it('keeps SR too, and unblocking allows new reserves', () => {
    expect(decideReserve(member, raid, { ...pick, hr: 300, sr: 100 }, { ...blocked, existingReserves: [{ ...existing, kind: 'SR' }] }, now)).toEqual({ ok: true });
    expect(decideReserve(member, raid, pick, { ...blocked, blockedItemIds: new Set() }, now)).toEqual({ ok: true });
  });

  it('still counts kept blocked reserves when resolving drops', () => {
    const holder = { ...existing, userId: 'u1' };
    expect(resolveDrop(100, [holder], [], [])).toEqual({ mode: 'HR', contenders: [holder] });
    const soft = { ...holder, kind: 'SR' as const };
    expect(resolveDrop(100, [soft], [], [])).toEqual({ mode: 'SR', contenders: [soft] });
  });
});

describe('pickUnavailable', () => {
  const none = { won: new Set<number>(), otherSlotPick: null, blocked: new Set<number>() };

  it.each([
    ['nothing', none, null],
    ['blocked', { ...none, blocked: new Set([100]) }, 'blocked'],
    ['previously won', { ...none, won: new Set([100]) }, 'won'],
    ['the other slot', { ...none, otherSlotPick: 100 }, 'otherSlot'],
    ['won and blocked', { ...none, won: new Set([100]), blocked: new Set([100]) }, 'won'],
    ['won and the other slot', { ...none, won: new Set([100]), otherSlotPick: 100 }, 'won'],
    ['the other slot and blocked', { ...none, otherSlotPick: 100, blocked: new Set([100]) }, 'otherSlot'],
    ['all three', { won: new Set([100]), otherSlotPick: 100, blocked: new Set([100]) }, 'won'],
    ['other items only', { won: new Set([1]), otherSlotPick: 2, blocked: new Set([3]) }, null],
  ] as const)('%s gives %s', (_, ctx, expected) => {
    expect(pickUnavailable(100, ctx)).toBe(expected);
  });
});

describe('draftPickFor', () => {
  const rules = { won: [], blocked: [100], saved: { characterId: 'c1', hr: 100, sr: null } };

  it('keeps a saved blocked pick only for its own character and slot', () => {
    expect(draftPickFor('HR', 100, 'c1', rules)).toBe(100);
    expect(draftPickFor('HR', 100, 'c2', rules)).toBeNull();
    expect(draftPickFor('SR', 100, 'c1', rules)).toBeNull();
    expect(draftPickFor('HR', 100, 'c1', { ...rules, saved: { characterId: null, hr: null, sr: null } })).toBeNull();
  });

  it('restores the saved blocked pick when switching back to its character', () => {
    expect(draftPickFor('HR', null, 'c1', rules)).toBe(100);
    expect(draftPickFor('HR', 200, 'c1', rules)).toBe(200);
    expect(draftPickFor('HR', null, 'c2', rules)).toBeNull();
    expect(draftPickFor('SR', null, 'c1', rules)).toBeNull();
    // An open saved pick isn't restored: it can simply be chosen again.
    expect(draftPickFor('HR', null, 'c1', { ...rules, blocked: [] })).toBeNull();
  });

  it('keeps open items and drops ones this character already won', () => {
    expect(draftPickFor('SR', 200, 'c2', rules)).toBe(200);
    expect(draftPickFor('SR', 200, 'c2', { ...rules, won: [200] })).toBeNull();
    expect(draftPickFor('HR', 100, 'c1', { ...rules, won: [100] })).toBeNull();
    expect(draftPickFor('HR', null, 'c1', { ...rules, won: [100] })).toBeNull();
  });
});

describe('hrBlocked', () => {
  it('accepts an allowed count for future per-item limits', () => {
    const award = { characterId: 'c1', itemId: 100 };
    expect(hrBlocked('c1', 100, [award], [], 2)).toBe(false);
    expect(hrBlocked('c1', 100, [award, award], [], 2)).toBe(true);
  });
  it('blocks the same character and item unless an exception exists', () => {
    const awards = [{ characterId: 'c1', itemId: 100 }];
    expect(hrBlocked('c1', 100, awards)).toBe(true);
    expect(hrBlocked('c1', 200, awards)).toBe(false);
    expect(hrBlocked('c2', 100, awards)).toBe(false);
    expect(hrBlocked('c1', 100, awards, [{ characterId: 'c1', itemId: 100 }])).toBe(false);
  });
});

describe('resolveDrop', () => {
  const r = (userId: string, kind: 'HR' | 'SR', itemId = 100): ActiveReserve => ({ userId, characterId: `char-${userId}`, itemId, kind });
  const reserves = [r('a', 'HR'), r('b', 'HR'), r('c', 'SR'), r('d', 'SR', 200), r('e', 'HR', 300)];

  it('gives HR holders the roll when anyone hard-reserved', () => {
    expect(resolveDrop(100, reserves, [], [])).toEqual({ mode: 'HR', contenders: [r('a', 'HR'), r('b', 'HR')] });
  });

  it('falls to SR holders when nobody hard-reserved', () => {
    expect(resolveDrop(200, reserves, [], [])).toEqual({ mode: 'SR', contenders: [r('d', 'SR', 200)] });
  });

  it('is an open roll when nobody reserved it', () => {
    expect(resolveDrop(400, reserves, [], [])).toEqual({ mode: 'OPEN', contenders: [] });
  });

  it('sends a second copy to the HR holders who have not received it yet', () => {
    expect(resolveDrop(100, reserves, [{ itemId: 100, userId: 'a' }], [{ characterId: 'char-a', itemId: 100 }])).toEqual({ mode: 'HR', contenders: [r('b', 'HR')] });
  });

  it('moves on to SR, then open, as copies are handed out', () => {
    const both = [{ itemId: 100, userId: 'a' }, { itemId: 100, userId: 'b' }];
    expect(resolveDrop(100, reserves, both, [])).toEqual({ mode: 'SR', contenders: [r('c', 'SR')] });
    expect(resolveDrop(100, reserves, [...both, { itemId: 100, userId: 'c' }], [])).toMatchObject({ mode: 'OPEN' });
  });

  it('ignores disenchanted copies and awards of other items', () => {
    expect(resolveDrop(100, reserves, [{ itemId: 100, userId: null }, { itemId: 200, userId: 'a' }], [])).toMatchObject({ mode: 'HR', contenders: [r('a', 'HR'), r('b', 'HR')] });
  });

  it('skips an HR holder whose character already won the item through HR on another raid', () => {
    expect(resolveDrop(300, reserves, [], [{ characterId: 'char-e', itemId: 300 }])).toMatchObject({ mode: 'OPEN' });
    expect(resolveDrop(300, reserves, [], [{ characterId: 'char-e', itemId: 300 }], [{ characterId: 'char-e', itemId: 300 }])).toMatchObject({ mode: 'HR' });
  });

  it('skips previously winning SR holders and falls through HR, SR, then open', () => {
    const wins = ['a', 'b', 'c'].map((id) => ({ characterId: `char-${id}`, itemId: 100 }));
    expect(resolveDrop(100, reserves, [], wins.slice(0, 1))).toEqual({ mode: 'HR', contenders: [r('b', 'HR')] });
    expect(resolveDrop(100, reserves, [], wins.slice(0, 2))).toEqual({ mode: 'SR', contenders: [r('c', 'SR')] });
    expect(resolveDrop(100, reserves, [], wins)).toEqual({ mode: 'OPEN', contenders: [] });
    expect(resolveDrop(100, reserves, [], wins, [{ characterId: 'char-c', itemId: 100 }])).toEqual({ mode: 'SR', contenders: [r('c', 'SR')] });
  });

  it('preselects the matching method', () => {
    expect(defaultMethodFor('HR')).toBe('HR');
    expect(defaultMethodFor('SR')).toBe('SR');
    expect(defaultMethodFor('OPEN')).toBe('OPEN_ROLL');
  });

  it('offers only the four current loot methods for new records', () => {
    expect(LOOT_LOG_METHODS).toEqual(['HR', 'SR', 'OPEN_ROLL', 'DISENCHANT_BANK']);
  });

  it('groups holders by item and kind, keeping their order', () => {
    expect(Object.fromEntries(reserveHolders(reserves))).toEqual({
      100: { HR: [r('a', 'HR'), r('b', 'HR')], SR: [r('c', 'SR')] },
      200: { HR: [], SR: [r('d', 'SR', 200)] },
      300: { HR: [r('e', 'HR', 300)], SR: [] },
    });
  });
});

describe('win limits', () => {
  const win = { characterId: 'c1', itemId: 100 };
  const save = (hrAwards: typeof win[], limit?: number, extra: Partial<ReserveContext> = {}) =>
    decideReserve(member, raid, pick, { ...ctx, hrAwards, ...(limit ? { winLimits: { 100: limit } } : {}), ...extra }, now);
  const sr = { characterId: 'c1', hr: 300, sr: 100 };

  it('reads 1 for an item with no setting', () => {
    expect(winLimitOf(100)).toBe(1);
    expect(winLimitOf(100, { 200: 3 })).toBe(1);
    expect(winLimitOf(200, { 200: 3 })).toBe(3);
  });

  it('limit 1 is the "won once" rule, for HR and SR', () => {
    for (const limit of [undefined, 1]) {
      expect(save([], limit)).toEqual({ ok: true });
      expect(save([win], limit)).toMatchObject({ ok: false, reason: REASONS.hrReceived });
      expect(decideReserve(member, raid, sr, { ...ctx, hrAwards: [win], winLimits: limit ? { 100: limit } : undefined }, now)).toMatchObject({ reason: REASONS.hrReceived });
    }
  });

  it('limit 2 allows another HR or SR after one win and refuses after two', () => {
    expect(save([win], 2)).toEqual({ ok: true });
    expect(decideReserve(member, raid, sr, { ...ctx, hrAwards: [win], winLimits: { 100: 2 } }, now)).toEqual({ ok: true });
    expect(save([win, win], 2)).toMatchObject({ ok: false, reason: REASONS.hrReceived });
    expect(decideReserve(member, raid, sr, { ...ctx, hrAwards: [win, win], winLimits: { 100: 2 } }, now)).toMatchObject({ reason: REASONS.hrReceived });
    // Another character's wins and another item's limit don't count.
    expect(save([{ ...win, characterId: 'c2' }, { ...win, characterId: 'c2' }], 2)).toEqual({ ok: true });
    expect(decideReserve(member, raid, pick, { ...ctx, hrAwards: [win], winLimits: { 200: 5 } }, now)).toMatchObject({ reason: REASONS.hrReceived });
  });

  it('a blocked item stays blocked whatever its limit', () => {
    for (const limit of [1, 2, 5]) expect(save([], limit, { blockedItemIds: new Set([100]) })).toMatchObject({ reason: REASONS.itemBlocked });
  });

  it('drop resolution skips holders at the limit, HR then SR', () => {
    const r = (userId: string, kind: 'HR' | 'SR'): ActiveReserve => ({ userId, characterId: `char-${userId}`, itemId: 100, kind });
    const reserves = [r('a', 'HR'), r('b', 'SR')];
    const wins = (id: string, n: number) => Array.from({ length: n }, () => ({ characterId: `char-${id}`, itemId: 100 }));
    expect(resolveDrop(100, reserves, [], wins('a', 1), [], { 100: 2 })).toEqual({ mode: 'HR', contenders: [r('a', 'HR')] });
    expect(resolveDrop(100, reserves, [], wins('a', 2), [], { 100: 2 })).toEqual({ mode: 'SR', contenders: [r('b', 'SR')] });
    expect(resolveDrop(100, reserves, [], [...wins('a', 2), ...wins('b', 2)], [], { 100: 2 })).toEqual({ mode: 'OPEN', contenders: [] });
    expect(resolveDrop(100, reserves, [], wins('a', 1))).toEqual({ mode: 'SR', contenders: [r('b', 'SR')] });
  });

  it('lowering the limit keeps a saved reserve but holds it back from drops and new saves', () => {
    // Saved at limit 2 after one win, then the officer lowers it to 1. Nothing in the rules
    // removes the row; it just stops counting.
    const saved = { userId: 'u1', characterId: 'c1', itemId: 100, kind: 'HR' as const };
    expect(save([win], 2)).toEqual({ ok: true });
    expect(resolveDrop(100, [saved], [], [win], [], { 100: 2 })).toEqual({ mode: 'HR', contenders: [saved] });
    expect(resolveDrop(100, [saved], [], [win], [], { 100: 1 })).toEqual({ mode: 'OPEN', contenders: [] });
    expect(save([win], 1, { existingReserves: [saved] })).toMatchObject({ reason: REASONS.hrReceived });
  });

  it.each([
    [1, true], [5, true], [3, true],
    [0, false], [6, false], [2.5, false], ['abc', false], ['2', false], [null, false], [undefined, false], [Number.NaN, false], [-1, false],
  ])('accepts %s as a limit: %s', (value, ok) => {
    const result = parseWinLimit(value);
    expect(result).toEqual(ok ? { ok: true, value } : { ok: false, error: 'The win limit must be a whole number from 1 to 5.' });
  });
});

describe('reserve picker totals and ownership copy', () => {
  const saved: ActiveReserve[] = [
    { userId: 'redtape', characterId: 'c1', itemId: 100, kind: 'HR' },
    { userId: 'ledgerline', characterId: 'c2', itemId: 100, kind: 'HR' },
    { userId: 'redtape', characterId: 'c1', itemId: 200, kind: 'SR' },
  ];

  it('includes both members in the same saved total, with HR and SR separate', () => {
    const holders = reserveHolders(saved);
    expect(holders.get(100)?.HR.map((h) => h.userId)).toEqual(['redtape', 'ledgerline']);
    expect(holders.get(100)?.SR).toEqual([]);
    expect(holders.get(200)?.SR.map((h) => h.userId)).toEqual(['redtape']);
    expect(holders.has(300)).toBe(false);
    expect(reserveHolders([]).size).toBe(0);
  });

  it('identifies the chosen slot separately from the item name and counts', () => {
    expect(RESERVES.picked('HR')).toBe('Picked as HR');
    expect(RESERVES.pickedDetails('HR', null)).toBe('Picked as your hard reserve');
    expect(RESERVES.pickedDetails('SR', 'redtape')).toBe("Picked as redtape's soft reserve");
  });
});

describe('parseItemRef', () => {
  it.each([
    ['17076', { id: 17076 }],
    [' item=17076 ', { id: 17076 }],
    ['https://www.wowhead.com/classic/item=17076/bonereavers-edge', { id: 17076, source: 'CLASSIC' }],
    ['https://www.wowhead.com/forever/item=250001', { id: 250001, source: 'FOREVER' }],
    ['https://www.wowhead.com/item=17076', { id: 17076 }],
  ])('reads %s', (text, expected) => {
    expect(parseItemRef(text)).toEqual(expected);
  });

  it.each(['', 'abc', '0', '-5', 'item=abc', 'notitem=5', 'item=17076abc', '10000000', 'https://www.wowhead.com/classic/spell=21153', '99999999999'])('refuses %j', (text) => {
    expect(parseItemRef(text)).toBeNull();
  });
});

describe('parseAwardInput', () => {
  it('reads a win with a roll and note', () => {
    expect(parseAwardInput({ bossId: 'b1', itemId: 100, characterId: 'c1', method: 'HR', roll: '87', note: ' won ' })).toEqual({
      ok: true,
      value: { bossId: 'b1', itemId: 100, characterId: 'c1', method: 'HR', roll: 87, note: 'won' },
    });
  });

  it('drops the character for disenchant/bank and needs one otherwise', () => {
    expect(parseAwardInput({ itemId: 100, characterId: 'c1', method: 'DISENCHANT_BANK' })).toMatchObject({ ok: true, value: { characterId: null, bossId: null, roll: null } });
    expect(parseAwardInput({ itemId: 100, method: 'OPEN_ROLL' })).toEqual({ ok: false, error: 'Pick who won it.' });
  });

  it.each([
    [{ method: 'HR', characterId: 'c1' }, 'Pick an item.'],
    [{ itemId: 100, characterId: 'c1', method: 'COUNCIL' }, 'Pick how it was handed out.'],
    [{ itemId: 100, characterId: 'c1', method: 'HR', roll: 101 }, 'A roll is 1 to 100.'],
    [{ itemId: 100, characterId: 'c1', method: 'HR', roll: 2.5 }, 'A roll is 1 to 100.'],
    [{ itemId: true, characterId: 'c1', method: 'HR' }, 'Pick an item.'],
    [{ itemId: 100, characterId: 'c1', method: 'HR', roll: true }, 'A roll is 1 to 100.'],
  ])('refuses %j', (body, error) => {
    expect(parseAwardInput(body)).toEqual({ ok: false, error });
  });
});

describe('decideVoid', () => {
  it('voids once', () => {
    expect(decideVoid({ voidedAt: null })).toEqual({ ok: true });
    expect(decideVoid({ voidedAt: now })).toEqual({ ok: false, status: 409, reason: REASONS.alreadyVoided });
  });
});
