import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ session: vi.fn(), flag: vi.fn(), raid: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: m.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: m.flag }));
vi.mock('@/lib/db', () => ({ db: { raid: { findUnique: m.raid }, lootTableEntry: { count: async () => 1 }, lootAward: { findMany: async () => [] } } }));
import { GET } from './route';
const request = () => GET(new Request('http://localhost/members/calendar/r1/loot'), { params: Promise.resolve({ raidId: 'r1' }) });
beforeEach(() => {
  vi.clearAllMocks(); m.flag.mockReturnValue(true); m.session.mockResolvedValue({ role: 'member' });
  m.raid.mockResolvedValue({ startsAt: new Date('2000-01-01'), durationMin: 180, cancelledAt: null, templateId: 't1' });
});
it.each([null, { role: 'social' }])('denies %s through the real loader', async (session) => {
  m.session.mockResolvedValue(session);
  const response = await request();
  expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: 'Not found' });
  expect(m.raid).not.toHaveBeenCalled();
});
it('denies when disabled', async () => {
  m.flag.mockReturnValue(false); expect((await request()).status).toBe(404); expect(m.raid).not.toHaveBeenCalled();
});
it('serves member-safe data without caching', async () => {
  const response = await request();
  expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toMatchObject({ awards: [], live: false });
});
