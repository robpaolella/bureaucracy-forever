import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ users: [] as Record<string, unknown>[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
// A tiny stand-in for Prisma that honours the filters the roster query sets.
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: async ({ where }: { where: { inGuild?: boolean; role?: { not: string }; availability?: null } }) =>
        m.users.filter(
          (u) =>
            (where.inGuild === undefined || u.inGuild === where.inGuild) &&
            (!where.role || u.role !== where.role.not) &&
            (where.availability !== null || u.availability === null),
        ),
    },
  },
}));
import { getRosterAvailability, loadNotSubmitted } from './roster-availability';

const user = (discordName: string, over: Record<string, unknown> = {}) => ({
  discordId: `id-${discordName}`, discordName, role: 'MEMBER', inGuild: true, timezone: null, availability: null, characters: [], ...over,
});
beforeEach(() => {
  m.users = [
    user('Here'),
    user('Left', { inGuild: false }),
    user('Social', { role: 'SOCIAL' }),
    user('HereSubmitted', { availability: { timezone: 'UTC', slots: {} } }),
    user('LeftSubmitted', { inGuild: false, availability: { timezone: 'UTC', slots: {} } }),
  ];
});

it('names only in-guild, non-social members who have not submitted', async () => {
  expect((await loadNotSubmitted()).map((u) => u.discordName)).toEqual(['Here']);
});
it('counts only in-guild, non-social members on the roster', async () => {
  expect((await getRosterAvailability()).map((u) => u.name)).toEqual(['Here', 'HereSubmitted']);
});
it('is empty when everyone left', async () => {
  m.users = [user('Left', { inGuild: false })];
  expect(await getRosterAvailability()).toEqual([]);
  expect(await loadNotSubmitted()).toEqual([]);
});
