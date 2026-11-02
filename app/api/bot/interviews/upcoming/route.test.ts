import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; applicationId: string; status: string; bookedStart: Date | null; bookedById: string | null; application: { character: string; discordThreadId: string | null } };
const store = vi.hoisted(() => ({ rows: [] as Row[] }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: {
    interview: {
      findMany: async ({ where, orderBy }: { where: { status: string; bookedStart: { gt: Date } }; orderBy: { bookedStart?: 'asc'; id?: 'asc' }[] }) => {
        expect(orderBy).toEqual([{ bookedStart: 'asc' }, { id: 'asc' }]);
        return store.rows
          .filter((r) => r.status === where.status && r.bookedStart && r.bookedStart > where.bookedStart.gt)
          .sort((a, b) => a.bookedStart!.getTime() - b.bookedStart!.getTime() || a.id.localeCompare(b.id));
      },
    },
    user: { findMany: async () => [{ id: 'u1', discordId: '100000000000000001', discordName: 'Officer One' }] },
  },
}));

import { GET } from './route';
import { existsSync, readdirSync } from 'node:fs';
import { getSortedRoutes } from 'next/dist/shared/lib/router/utils/sorted-routes';
import { getRouteMatcher } from 'next/dist/shared/lib/router/utils/route-matcher';
import { getRouteRegex } from 'next/dist/shared/lib/router/utils/route-regex';
import { join } from 'node:path';

const hours = (n: number) => new Date(Date.now() + n * 3_600_000);
const seed = (id: string, start: Date | null, over: Partial<Row> = {}) =>
  store.rows.push({ id, applicationId: `app-${id}`, status: 'BOOKED', bookedStart: start, bookedById: 'u1', application: { character: `Char ${id}`, discordThreadId: `thread-${id}` }, ...over });
const call = (secret: string | null = 'test-secret') =>
  GET(new Request('https://example.test/api/bot/interviews/upcoming', { headers: secret ? { authorization: `Bearer ${secret}` } : {} }));

describe('GET /api/bot/interviews/upcoming', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.rows = [];
  });

  it('refuses a missing or bad signature', async () => {
    seed('a', hours(1));
    expect((await call(null)).status).toBe(401);
    expect((await call('wrong')).status).toBe(401);
  });
  it('lists upcoming booked interviews in start order, ties by id, in the digest item shape', async () => {
    const same = hours(5);
    seed('c', same);
    seed('b', same);
    seed('a', hours(2));
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const { interviews } = await res.json();
    expect(interviews.map((i: { interviewId: string }) => i.interviewId)).toEqual(['a', 'b', 'c']);
    expect(interviews[0]).toEqual({
      interviewId: 'a', applicationId: 'app-a', startsAt: store.rows[2].bookedStart!.toISOString(), characterName: 'Char a',
      bookedBy: { discordId: '100000000000000001', name: 'Officer One' }, threadId: 'thread-a',
    });
  });
  it('leaves out past and non-booked interviews', async () => {
    seed('past', hours(-1));
    seed('proposed', hours(3), { status: 'PROPOSED' });
    seed('done', hours(3), { status: 'DONE' });
    seed('ok', hours(3));
    const { interviews } = await (await call()).json();
    expect(interviews.map((i: { interviewId: string }) => i.interviewId)).toEqual(['ok']);
  });
  it('returns an empty list when none are upcoming', async () => {
    expect(await (await call()).json()).toEqual({ interviews: [] });
  });
  it('gives null for an unknown booker and for no thread', async () => {
    seed('a', hours(1), { bookedById: null, application: { character: 'Char a', discordThreadId: null } });
    const { interviews } = await (await call()).json();
    expect(interviews[0].bookedBy).toBeNull();
    expect(interviews[0].threadId).toBeNull();
  });
  it('is matched before the [id] route, using Next\'s own route ordering', () => {
    const dir = join(__dirname, '..');
    const routes = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'route.ts')))
      .map((e) => `/api/bot/interviews/${e.name}`);
    expect(routes).toContain('/api/bot/interviews/[id]');
    const sorted = getSortedRoutes(routes);
    const target = '/api/bot/interviews/upcoming';
    const match = sorted.find((r) => getRouteMatcher(getRouteRegex(r))(target));
    expect(match).toBe(target);
  });
});
