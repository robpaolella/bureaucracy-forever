import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

// Opt-in real PostgreSQL proof of the /broadcast raid routes. Owns a fresh loopback-only container, never an existing DB.
// RAID_BROADCAST_INTEGRATION=1 npx vitest run app/api/bot/raids/route.integration.test.ts
const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
import { GET as LIST } from './route';
import { GET as SIGNUPS } from './[id]/signups/route';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
const DAY = 24 * 60 * 60_000;
const SECRET = 'raid-broadcast-test-secret';
const OFFICER = '100000000000000001';
const MEMBER = '100000000000000002';
const call = (path: string) => new Request(`http://localhost/api/bot/raids${path}?byDiscordId=${OFFICER}`, { headers: { authorization: `Bearer ${SECRET}` } });

// All data is synthetic; the database and container are created and removed by this suite.
describe.skipIf(process.env.RAID_BROADCAST_INTEGRATION !== '1')('/api/bot/raids broadcast reads on real PostgreSQL', () => {
  let container: string;
  let pool: Pool;
  let client: PrismaClient;

  beforeAll(async () => {
    process.env.BOT_SHARED_SECRET = SECRET;
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=raid_broadcast_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/raid_broadcast_test` });
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
    await client.user.create({ data: { id: 'u-officer', discordId: OFFICER, discordName: 'Sample officer', role: 'OFFICER' } });
    await client.user.create({ data: { id: 'u-member', discordId: MEMBER, discordName: 'Sample member', role: 'MEMBER' } });
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });

  const makeRaid = (id: string, days: number, extra: object = {}) => {
    const startsAt = new Date(Date.now() + days * DAY);
    return client.raid.create({ data: { id, name: `Raid ${id}`, startsAt, locksAt: startsAt, requirements: {}, ...extra } });
  };

  it('lists from seven days ago in start order, any status, and drops the furthest-future past 25', async () => {
    await makeRaid('old', -8);
    await makeRaid('edge', -7 + 0.01);
    await makeRaid('cancelled', -1, { status: 'CANCELLED' });
    for (let i = 0; i < 25; i++) await makeRaid(`f${String(i).padStart(2, '0')}`, 1 + i);
    const res = await LIST(call(''));
    expect(res.status).toBe(200);
    const { raids } = (await res.json()) as { raids: { id: string; status: string }[] };
    expect(raids).toHaveLength(25);
    expect(raids.slice(0, 3).map((r) => r.id)).toEqual(['edge', 'cancelled', 'f00']);
    expect(raids[1].status).toBe('CANCELLED');
    expect(raids.some((r) => r.id === 'old' || r.id === 'f24')).toBe(false);
  });

  it("returns every sign-up row with the member's Discord id", async () => {
    await makeRaid('signed', 3, { signups: { create: [
      { userId: 'u-officer', response: 'TENTATIVE', standing: 'BENCH', source: 'WEB' },
      { userId: 'u-member', response: null, standing: 'ROSTER', source: 'DISCORD' },
    ] } });
    const res = await SIGNUPS(call('/signed/signups'), { params: Promise.resolve({ id: 'signed' }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { raid: { id: string }; signups: unknown[] };
    expect(body.raid.id).toBe('signed');
    expect(body.signups).toHaveLength(2);
    expect(body.signups).toEqual(expect.arrayContaining([
      { discordId: OFFICER, response: 'TENTATIVE', standing: 'BENCH' },
      { discordId: MEMBER, response: null, standing: 'ROSTER' },
    ]));
    expect((await SIGNUPS(call('/nope/signups'), { params: Promise.resolve({ id: 'nope' }) })).status).toBe(404);
  });
});
