import { beforeEach, expect, it, vi } from 'vitest';
const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/loot-data', () => ({ loadMemberRaidLoot: load }));
import { GET } from './route';
beforeEach(() => load.mockReset());
it.each([null, { awards: [], startsAt: 'start', endsAt: 'end' }])('never caches member loot or denials: %j', async (data) => {
  load.mockResolvedValue(data);
  const response = await GET(new Request('http://localhost/members/calendar/r1/loot'), { params: Promise.resolve({ raidId: 'r1' }) });
  expect(load).toHaveBeenCalledWith('r1');
  expect(response.status).toBe(data ? 200 : 404);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual(data);
});
