import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
const m = vi.hoisted(() => ({ db: null as unknown as PrismaClient, session: vi.fn(), flag: vi.fn() }));
vi.mock('@/lib/db', () => ({ get db() { return m.db; } }));
vi.mock('@/lib/session', () => ({ getSession: m.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: m.flag }));
import { loadMemberLootHistory } from '@/lib/member-loot';
import { GET } from './route';
const request = (query = 'startsAt=2030-01-01T00:00:00.000Z&id=raid') => new Request(`http://localhost/members/loot/older?${query}`);
beforeEach(() => { m.session.mockResolvedValue({ role: 'member' }); m.flag.mockReturnValue(true); });
it.each(['', 'startsAt=bad&id=x', 'startsAt=2030-01-01T00:00:00.000Z&id='])('rejects malformed cursors: %s', async (query) => {
  expect((await GET(request(query))).status).toBe(400);
});
it.each([null, { role: 'social' }])('denies older-page data to %s', async (session) => {
  m.session.mockResolvedValue(session);
  const response = await GET(request());
  expect(response.status).toBe(404); expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('404s the older-page endpoint with loot off', async () => {
  m.flag.mockReturnValue(false); expect((await GET(request())).status).toBe(404);
});

// LOOT_HISTORY_INTEGRATION=1 npx vitest run 'app/(site)/members/loot/older/route.test.ts'
// Owns a fresh loopback-only Postgres; never reads settings or touches the browser's fixture.
describe.skipIf(process.env.LOOT_HISTORY_INTEGRATION !== '1')('history paging on Postgres', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=history_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/history_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (e) {
        if (attempt === 60) throw e;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    db = new PrismaClient({ adapter: new PrismaPg(pool) }); m.db = db;
    await db.lootItem.create({ data: { id: 1, name: 'Blade', quality: 4, icon: 'inv', tooltipHtml: '<b>Blade</b>', source: 'CLASSIC', fetchedAt: new Date() } });
    await db.raidTemplate.create({ data: { id: 'tier', name: 'Sample', short: 'S', size: 40, requirements: {}, lootBosses: { create: { name: 'Boss', position: 0, entries: { create: { itemId: 1, position: 0 } } } } } });
    await db.raidTemplate.create({ data: { id: 'empty', name: 'Empty', short: 'E', size: 40, requirements: {} } });
    await db.raidTemplate.create({ data: { id: 'other', name: 'Other', short: 'O', size: 40, requirements: {}, lootBosses: { create: { name: 'Other boss', position: 0, entries: { create: { itemId: 1, position: 0 } } } } } });
    await db.user.create({ data: { id: 'u', discordId: 'sample', discordName: 'Sample', characters: { create: { id: 'c', name: 'Current', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' } } } });
    for (const [id, count, date, extra] of [
      ['z', 30, '2020-01-03', {}], ['y', 20, '2020-01-03', {}], ['x', 51, '2020-01-02', {}], ['w', 1, '2020-01-01', {}],
      ['cancelled', 1, '2020-01-04', { cancelledAt: new Date() }], ['future', 1, '2099-01-01', {}], ['no-table', 1, '2020-01-04', { templateId: 'empty' }], ['void-only', 1, '2020-01-04', {}], ['no-awards', 0, '2020-01-04', {}], ['other-raid', 2, '2019-01-01', { templateId: 'other' }],
    ] as const) {
      await db.raid.create({ data: { id, name: id, startsAt: new Date(date), locksAt: new Date(date), requirements: {}, templateId: 'tier', ...extra } });
      for (let i = count - 1; i >= 0; i--) await db.lootAward.create({ data: {
        id: `${id}-${String(i).padStart(2, '0')}`, raidId: id, itemId: 1, characterId: 'c', characterName: 'Recorded', method: 'SR', roll: 74,
        recordedById: 'private', note: 'private note', createdAt: new Date(`2020-01-01T00:00:${String(i).padStart(2, '0')}Z`),
        ...(id === 'void-only' && { voidedAt: new Date(), voidReason: 'private reason' }),
      } });
    }
    await db.lootAward.update({ where: { id: 'y-00' }, data: { method: 'DISENCHANT_BANK', characterId: null, characterName: null, roll: null } });
  }, 120_000);
  afterAll(async () => { await db?.$disconnect(); await pool?.end(); if (container) docker('stop', container); });
  it.each(['member', 'officer'])('pages whole visible raids for %s, including ties and oversized raids', async (role) => {
    m.session.mockResolvedValue({ role });
    const first = (await loadMemberLootHistory())!;
    expect(first.raids.map((r) => r.id)).toEqual(['z', 'y']);
    expect(first.raids.map((r) => r.awards.length)).toEqual([30, 20]);
    expect(first.total).toBe(104); expect(first.filteredTotal).toBe(104);
    expect(first.options.characters).toEqual([{ id: 'c', name: 'Current' }]); expect(first.options.raids).toEqual([{ id: 'other', name: 'Other' }, { id: 'tier', name: 'Sample' }]);
    expect(first.raids[0].awards.map((a) => a.id)).toEqual(Array.from({ length: 30 }, (_, i) => `z-${String(i).padStart(2, '0')}`));
    expect(JSON.stringify(first)).not.toContain('private');
    expect(first.raids[1].awards[0]).toMatchObject({ characterId: null, characterName: null, roll: null });
    const response = await GET(request(new URLSearchParams(first.next!).toString()));
    const second = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(second.raids.map((r: { id: string }) => r.id)).toEqual(['x']); expect(second.raids[0].awards).toHaveLength(51);
    const third = (await loadMemberLootHistory(second.next))!;
    expect(third.raids.map((r) => r.id)).toEqual(['w', 'other-raid']); expect(third.next).toBeNull();
    // A cursor inside an equal-time pair must not skip the second raid.
    expect((await loadMemberLootHistory({ id: 'z', startsAt: first.raids[0].startsAt }))!.raids.map((r) => r.id)).toEqual(['y']);
  });
  it('filters current characters and template ids before paging, while unknown values fall back', async () => {
    const current = (await loadMemberLootHistory(null, { characterId: 'c' }))!;
    expect(current.filters).toEqual({ characterId: 'c' }); expect(current.filteredTotal).toBe(103);
    expect(current.raids.map((raid) => raid.id)).toEqual(['z', 'y']);
    const filtered = (await loadMemberLootHistory(null, { characterId: 'c', templateId: 'tier' }))!;
    expect(filtered.filteredTotal).toBe(101); expect(filtered.next).not.toBeNull();
    const raid = (await loadMemberLootHistory(null, { templateId: 'other' }))!;
    expect(raid.filters).toEqual({ templateId: 'other' }); expect(raid.filteredTotal).toBe(2); expect(raid.raids.map((entry) => entry.id)).toEqual(['other-raid']);
    const unknown = (await loadMemberLootHistory(null, { characterId: 'missing', characterName: 'missing', templateId: 'missing' }))!;
    expect(unknown.filters).toEqual({}); expect(unknown.filteredTotal).toBe(104);
  });
  it('preserves recorded names after deletion, filters them separately from ids, and returns empty after the last cursor', async () => {
    await db.character.delete({ where: { id: 'c' } });
    const history = (await loadMemberLootHistory())!;
    expect(history.raids[0].awards[0]).toMatchObject({ characterId: null, characterName: 'Recorded', wowClass: null });
    expect(history.options.formerCharacters).toEqual(['Recorded']);
    const former = (await loadMemberLootHistory(null, { characterName: 'Recorded' }))!;
    expect(former.filters).toEqual({ characterName: 'Recorded' }); expect(former.filteredTotal).toBe(103);
    expect((await loadMemberLootHistory(null, { characterId: 'Recorded' }))!.filters).toEqual({});
    expect(await loadMemberLootHistory({ id: 'other-raid', startsAt: '2019-01-01T00:00:00.000Z' })).toMatchObject({ raids: [], next: null });
  });
});
