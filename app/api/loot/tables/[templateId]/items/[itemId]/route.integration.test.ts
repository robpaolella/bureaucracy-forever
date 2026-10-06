import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@/lib/generated/prisma/client';

// Opt-in real PostgreSQL proof. Owns a fresh loopback-only container, never an existing DB.
// LOOT_BLOCK_INTEGRATION=1 npx vitest run 'app/api/loot/tables/[templateId]/items/[itemId]/route.integration.test.ts'
const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, role: 'officer' }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: state.role, discordId: 'block-test' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'u1' }) }));
import { PUT } from './route';
import { PUT as saveReserves } from '../../../../../raids/[id]/reserves/route';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
};
const HOUR = 60 * 60_000;
const block = async (remove: string[]) => {
  state.role = 'officer';
  const res = await PUT(new Request('http://localhost/test', { method: 'PUT', body: JSON.stringify({ blocked: true, remove }) }), { params: Promise.resolve({ templateId: 't1', itemId: '100' }) });
  return { status: res.status, json: await res.json() };
};
const save = async () => {
  state.role = 'member';
  return saveReserves(new Request('http://localhost/test', { method: 'PUT', body: JSON.stringify({ characterId: 'c1', hr: 100, sr: null }) }), { params: Promise.resolve({ id: 'r-open' }) });
};

// All data is synthetic; the database and container are created and removed by this suite.
describe.skipIf(process.env.LOOT_BLOCK_INTEGRATION !== '1')('real PostgreSQL block confirmation', () => {
  let container: string;
  let pool: Pool;
  let client: PrismaClient;

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=block_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/block_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) {
      await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    }
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    state.db = client;
    await client.raidTemplate.create({ data: { id: 't1', name: 'Block test', short: 'BT', size: 10, requirements: {} } });
    for (const [u, c] of [['u1', 'c1'], ['u2', 'c2'], ['u3', 'c3'], ['u4', 'c4']]) {
      await client.user.create({ data: { id: u, discordId: u === 'u1' ? 'block-test' : `sample-${u}`, discordName: `Sample ${u}`, characters: { create: { id: c, name: `Sample ${c}`, class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' } } } });
    }
    const now = Date.now();
    const raids: [string, Date, Date | null][] = [
      ['r-open', new Date(now + 72 * HOUR), null],
      ['r-cancelled', new Date(now + 96 * HOUR), new Date(now)],
      ['r-locked', new Date(now + HOUR), null],
      ['r-past', new Date(now - 24 * HOUR), null],
    ];
    for (const [id, startsAt, cancelledAt] of raids) {
      await client.raid.create({ data: { id, name: `Raid ${id}`, templateId: 't1', startsAt, locksAt: startsAt, cancelledAt, requirements: {}, signups: { create: { userId: 'u1', response: 'ACCEPT', source: 'WEB' } } } });
    }
    await client.lootItem.create({ data: { id: 100, name: 'Item 100', quality: 4, icon: '', tooltipHtml: '', source: 'CLASSIC', fetchedAt: new Date() } });
    await client.lootBoss.create({ data: { templateId: 't1', name: 'Sample boss', position: 0, entries: { create: [{ itemId: 100, position: 0 }] } } });
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });

  beforeEach(async () => {
    state.db = client;
    await client.reserve.deleteMany();
    await client.lootReserveSetting.deleteMany();
  });

  const hold = (raidId: string, user: string, kind: 'HR' | 'SR') =>
    client.reserve.create({ data: { raidId, userId: `u${user}`, characterId: `c${user}`, itemId: 100, kind } });
  const blocked = async () => (await client.lootReserveSetting.findFirst({ where: { itemId: 100 } }))?.blocked ?? false;

  /** Pause the first transaction immediately after its real PostgreSQL tier lock, optionally failing a write. */
  function wrap({ pause = false, failUpsert = false }) {
    const acquired = deferred();
    const release = deferred();
    let first = pause;
    state.db = new Proxy(client, { get(target, key) {
      if (key !== '$transaction') return Reflect.get(target, key);
      return (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) => target.$transaction(async (tx) => run(new Proxy(tx, { get(t, k) {
        if (k === 'lootReserveSetting' && failUpsert) return { upsert: async () => { throw new Error('connection lost'); } };
        if (k !== '$queryRaw') return Reflect.get(t, k);
        return async (...args: Parameters<typeof tx.$queryRaw>) => {
          const result = await tx.$queryRaw(...args);
          if (first) { first = false; acquired.resolve(); await release.promise; }
          return result;
        };
      } })), { ...options, timeout: 15_000 });
    } });
    return { acquired, release };
  }

  async function waitForBlockedQuery() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const { rows } = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%RaidTemplate%'");
      if (rows.length) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Second transaction did not wait for the tier lock');
  }

  it('removes only reserves on unlocked raids, cancelled ones included, and blocks', async () => {
    await hold('r-open', '1', 'HR');
    await hold('r-cancelled', '2', 'SR');
    await hold('r-locked', '3', 'HR');
    await hold('r-past', '4', 'SR');
    const { status, json } = await block(['r-open:c1:HR', 'r-cancelled:c2:SR']);
    expect(status).toBe(200);
    expect(json).toEqual({ itemId: 100, blocked: true, removed: 2 });
    expect(await blocked()).toBe(true);
    expect((await client.reserve.findMany({ select: { raidId: true }, orderBy: { raidId: 'asc' } })).map((r) => r.raidId)).toEqual(['r-locked', 'r-past']);
  });

  it('refuses a confirmation missing a holder, writing nothing, and returns the current list', async () => {
    await hold('r-open', '1', 'HR');
    await hold('r-cancelled', '2', 'SR');
    const { status, json } = await block(['r-open:c1:HR']);
    expect(status).toBe(409);
    expect(json.holders.map((h: { key: string }) => h.key)).toEqual(['r-open:c1:HR', 'r-cancelled:c2:SR']);
    expect(json.holders[1]).toMatchObject({ character: 'Sample c2', kind: 'SR', raid: { id: 'r-cancelled', cancelled: true } });
    expect(await blocked()).toBe(false);
    expect(await client.reserve.count()).toBe(2);
  });

  it('a failure part-way writes nothing: the removal rolls back with the block', async () => {
    await hold('r-open', '1', 'HR');
    wrap({ failUpsert: true });
    await expect(block(['r-open:c1:HR'])).rejects.toThrow('connection lost');
    state.db = client;
    expect(await client.reserve.count()).toBe(1);
    expect(await blocked()).toBe(false);
  });

  it('save first: the direct block waits, finds the new holder and is refused, so nothing is removed unseen', async () => {
    const gate = wrap({ pause: true });
    const saving = save();
    await gate.acquired.promise;
    const blocking = block([]);
    try { await waitForBlockedQuery(); } finally { gate.release.resolve(); }
    expect((await saving).status).toBe(200);
    const { status, json } = await blocking;
    expect(status).toBe(409);
    expect(json.holders.map((h: { key: string }) => h.key)).toEqual(['r-open:c1:HR']);
    state.db = client;
    expect(await blocked()).toBe(false);
    expect(await client.reserve.count()).toBe(1);
  }, 20_000);

  it('block first: the waiting save reads the committed block and is refused, leaving no reserve on the item', async () => {
    await hold('r-open', '2', 'SR');
    const gate = wrap({ pause: true });
    const blocking = block(['r-open:c2:SR']);
    await gate.acquired.promise;
    const saving = save();
    try { await waitForBlockedQuery(); } finally { gate.release.resolve(); }
    expect((await blocking).json).toEqual({ itemId: 100, blocked: true, removed: 1 });
    expect((await saving).status).toBe(409);
    state.db = client;
    expect(await blocked()).toBe(true);
    expect(await client.reserve.count({ where: { itemId: 100, raidId: 'r-open' } })).toBe(0);
  }, 20_000);
});
