import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ session: vi.fn(), flag: vi.fn(), raid: vi.fn(), entries: vi.fn(), awards: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: m.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: m.flag }));
vi.mock('@/lib/db', () => ({ db: { $transaction: m.transaction, raid: { findUnique: m.raid }, lootTableEntry: { count: m.entries }, lootAward: { findMany: m.awards } } }));
import { loadMemberLootHistory, loadMemberRaidLoot } from './member-loot';

const raid = { startsAt: new Date('2030-01-01T20:00Z'), durationMin: 180, cancelledAt: null, templateId: 't1' };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(raid.startsAt); vi.clearAllMocks();
  m.session.mockResolvedValue({ role: 'member' }); m.flag.mockReturnValue(true);
  m.raid.mockResolvedValue(raid); m.entries.mockResolvedValue(1); m.awards.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('member history access', () => {
  it.each([null, { role: 'social' }])('denies %s without querying', async (session) => {
    m.session.mockResolvedValue(session);
    expect(await loadMemberLootHistory()).toBeNull(); expect(m.transaction).not.toHaveBeenCalled();
  });
  it('denies a disabled flag before session access', async () => {
    m.flag.mockReturnValue(false);
    expect(await loadMemberLootHistory()).toBeNull(); expect(m.session).not.toHaveBeenCalled();
  });
});

describe('member-safe raid loot', () => {
  it.each([null, { role: 'social' }])('denies %s before querying', async (session) => {
    m.session.mockResolvedValue(session);
    expect(await loadMemberRaidLoot('r1')).toBeNull(); expect(m.raid).not.toHaveBeenCalled();
  });
  it('denies when disabled before even reading the session', async () => {
    m.flag.mockReturnValue(false);
    expect(await loadMemberRaidLoot('r1')).toBeNull(); expect(m.session).not.toHaveBeenCalled();
  });
  it.each([null, { ...raid, cancelledAt: new Date() }, { ...raid, templateId: null }, { ...raid, startsAt: new Date('2030-01-02') }])('denies unavailable raids: %s', async (value) => {
    m.raid.mockResolvedValue(value);
    expect(await loadMemberRaidLoot('r1')).toBeNull(); expect(m.awards).not.toHaveBeenCalled();
  });
  it('requires a populated tier, as reserves do', async () => {
    m.entries.mockResolvedValue(0);
    expect(await loadMemberRaidLoot('r1')).toBeNull(); expect(m.awards).not.toHaveBeenCalled();
    expect(m.entries).toHaveBeenCalledWith({ where: { boss: { templateId: 't1' } } });
  });
  it.each(['member', 'officer'])('allows %s at start and marks the exact end as not live', async (role) => {
    m.session.mockResolvedValue({ role });
    expect(await loadMemberRaidLoot('r1')).toMatchObject({ live: true, awards: [] });
    vi.setSystemTime(new Date('2030-01-01T23:00Z'));
    expect(await loadMemberRaidLoot('r1')).toMatchObject({ live: false, endsAt: '2030-01-01T23:00:00.000Z' });
  });
  it('selects only safe fields, filters voided rows, preserves recorded order and sanitizes items', async () => {
    const base = { id: 'a', characterName: 'Recorded', character: { id: 'c1', name: 'Current', class: 'MAGE' }, method: 'SR', roll: 72, bossName: 'Onyxia', item: { id: 1, name: 'Blade', quality: 4, icon: 'inv', tooltipHtml: '<script>bad()</script><b>Blade</b>' }, note: 'private', recordedById: 'officer', voidReason: 'private' };
    m.awards.mockResolvedValue([base, { ...base, id: 'b', character: null }, { ...base, id: 'c', method: 'DISENCHANT_BANK' }]);
    const result = await loadMemberRaidLoot('r1');
    expect(m.awards).toHaveBeenCalledWith({
      where: { raidId: 'r1', voidedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, characterName: true, method: true, roll: true, bossName: true,
        character: { select: { id: true, name: true, class: true } },
        item: { select: { id: true, name: true, quality: true, icon: true, tooltipHtml: true } } },
    });
    expect(result?.awards).toEqual([
      { id: 'a', item: { ...base.item, tooltipHtml: '<b>Blade</b>' }, characterId: 'c1', characterName: 'Current', wowClass: 'mage', method: 'SR', roll: 72, bossName: 'Onyxia' },
      { id: 'b', item: { ...base.item, tooltipHtml: '<b>Blade</b>' }, characterId: null, characterName: 'Recorded', wowClass: null, method: 'SR', roll: 72, bossName: 'Onyxia' },
      { id: 'c', item: { ...base.item, tooltipHtml: '<b>Blade</b>' }, characterId: null, characterName: null, wowClass: null, method: 'DISENCHANT_BANK', roll: null, bossName: 'Onyxia' },
    ]);
  });
});
