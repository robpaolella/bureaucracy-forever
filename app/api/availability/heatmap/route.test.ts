import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ session: vi.fn(), users: [] as Record<string, unknown>[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/session', () => ({ getSession: m.session }));
// Stand-in for Prisma that honours the roster's inGuild and role filters.
vi.mock('@/lib/db', () => ({
  db: { user: { findMany: async ({ where }: { where: { inGuild?: boolean; role?: { not: string } } }) =>
    m.users.filter((u) => (where.inGuild === undefined || u.inGuild === where.inGuild) && (!where.role || u.role !== where.role.not)) } },
}));
import { GET } from './route';

const user = (discordName: string, over: Record<string, unknown> = {}) => ({
  discordName, role: 'MEMBER', inGuild: true, timezone: null, availability: null, characters: [], ...over,
});
const call = (tz = 'UTC') => GET(new NextRequest(`http://localhost/api/availability/heatmap?tz=${tz}`));
beforeEach(() => { vi.clearAllMocks(); m.session.mockResolvedValue({ role: 'officer' }); m.users = []; });

it.each([[null, 401], [{ role: 'member' }, 403]])('denies %j with %i', async (session, status) => {
  m.session.mockResolvedValue(session);
  expect((await call()).status).toBe(status);
});
it('rejects a bad zone', async () => {
  expect((await call('Nope')).status).toBe(400);
});
it('leaves out a member who left the server and a social', async () => {
  m.users = [user('Here'), user('Left', { inGuild: false }), user('Social', { role: 'SOCIAL' })];
  const response = await call();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.memberCount).toBe(1);
  expect(body.members.map((x: { name: string }) => x.name)).toEqual(['Here']);
});
it('shows the empty roster when everyone left', async () => {
  m.users = [user('Left', { inGuild: false })];
  const body = await (await call()).json();
  expect(body.memberCount).toBe(0);
  expect(body.members).toEqual([]);
});
