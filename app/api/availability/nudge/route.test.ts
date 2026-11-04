import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ session: vi.fn(), enqueue: vi.fn(), users: [] as Record<string, unknown>[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/session', () => ({ getSession: m.session }));
vi.mock('@/lib/outbox', () => ({ enqueue: m.enqueue }));
// Stand-in for Prisma that honours the roster's filters.
vi.mock('@/lib/db', () => ({
  db: { user: { findMany: async ({ where }: { where: { inGuild?: boolean; role?: { not: string }; availability?: null } }) =>
    m.users.filter((u) => (where.inGuild === undefined || u.inGuild === where.inGuild) && (!where.role || u.role !== where.role.not) && (where.availability !== null || u.availability === null)) } },
}));
import { POST } from './route';

const user = (discordName: string, over: Record<string, unknown> = {}) => ({ discordId: `id-${discordName}`, discordName, role: 'MEMBER', inGuild: true, availability: null, ...over });
beforeEach(() => { vi.clearAllMocks(); m.session.mockResolvedValue({ role: 'officer' }); m.users = []; });

it.each([[null, 401], [{ role: 'member' }, 403]])('denies %j with %i', async (session, status) => {
  m.session.mockResolvedValue(session);
  expect((await POST()).status).toBe(status);
  expect(m.enqueue).not.toHaveBeenCalled();
});
it('names only members still in the server', async () => {
  m.users = [user('Here'), user('Left', { inGuild: false }), user('Social', { role: 'SOCIAL' })];
  const response = await POST();
  expect(await response.json()).toEqual({ nudged: 1 });
  expect(m.enqueue).toHaveBeenCalledWith('officers.notify', { text: '1 member has not painted availability: Here', discordIds: ['id-Here'] });
});
it('queues nothing when only people who left are missing', async () => {
  m.users = [user('Left', { inGuild: false })];
  expect(await (await POST()).json()).toEqual({ nudged: 0 });
  expect(m.enqueue).not.toHaveBeenCalled();
});
