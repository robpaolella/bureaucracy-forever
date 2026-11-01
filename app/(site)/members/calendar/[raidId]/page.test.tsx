import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: null as null | { discordId: string; role: string }, raid: vi.fn(), user: vi.fn() }));
class NotFound extends Error {}
vi.mock('next/navigation', () => ({ notFound: () => { throw new NotFound(); } }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/db', () => ({ db: { raid: { findUnique: mocks.raid }, user: { findUnique: mocks.user, findMany: mocks.user } } }));
vi.mock('@/lib/raid-cards', () => ({ loadActiveTemplates: async () => [] }));
import RaidDetailPage, { generateMetadata } from './page';

const params = () => Promise.resolve({ raidId: 'raid-1' });
beforeEach(() => { vi.clearAllMocks(); mocks.raid.mockResolvedValue(null); mocks.user.mockResolvedValue(null); });

it.each([null, 'social'])('gives %s the not-found page and title before reading the raid', async (role) => {
  mocks.session = role ? { discordId: 'viewer', role } : null;
  await expect(RaidDetailPage({ params: params(), searchParams: Promise.resolve({}) })).rejects.toBeInstanceOf(NotFound);
  await expect(generateMetadata({ params: params() })).rejects.toBeInstanceOf(NotFound);
  expect(mocks.raid).not.toHaveBeenCalled();
  expect(mocks.user).not.toHaveBeenCalled();
});

it.each(['member', 'officer'])('reads the raid for a %s', async (role) => {
  mocks.session = { discordId: 'viewer', role };
  mocks.raid.mockResolvedValue({ name: 'Molten Core' });
  expect(await generateMetadata({ params: params() })).toMatchObject({ title: 'Molten Core' });
  // No such raid: the page reads it, then gives the 404 a missing raid gets.
  mocks.raid.mockResolvedValue(null);
  await expect(RaidDetailPage({ params: params(), searchParams: Promise.resolve({}) })).rejects.toBeInstanceOf(NotFound);
  expect(mocks.raid).toHaveBeenCalledTimes(2);
});
