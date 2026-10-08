import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ role: 'officer' as string | null, enabled: true, template: vi.fn(), cached: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.role ? { role: mocks.role } : null }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.enabled }));
vi.mock('@/lib/db', () => ({ db: { raidTemplate: { findUnique: mocks.template }, lootItem: { findMany: mocks.cached } } }));
vi.mock('@/lib/loot-items', () => ({ refreshItems: mocks.refresh }));
import { POST } from './route';

const file = (ids: number[]) => ({ bosses: [{ name: 'Ragnaros', items: ids }] });
const call = (body: unknown) => POST(new Request('https://example.test/api/loot/tables/mc/preview', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ templateId: 'mc' }) });
const ids = Array.from({ length: 45 }, (_, i) => i + 1);
beforeEach(() => {
  mocks.role = 'officer'; mocks.enabled = true;
  mocks.template.mockReset().mockResolvedValue({ id: 'mc', lootBosses: [], reserveSettings: [] });
  mocks.cached.mockReset().mockResolvedValue([]);
  mocks.refresh.mockReset().mockImplementation(async (_db, targets: { id: number }[]) => ({ saved: targets.map(({ id }) => id), failed: [], notReached: [] }));
});
afterEach(() => vi.unstubAllEnvs());

describe('loot table preview route', () => {
  it.each([null, 'member', 'social'])('404s for %s before reading or fetching', async (role) => {
    mocks.role = role;
    expect((await call({ file: file(ids) })).status).toBe(404);
    expect(mocks.template).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('404s with loot disabled or an unknown tier', async () => {
    mocks.enabled = false;
    expect((await call({ file: file(ids) })).status).toBe(404);
    mocks.enabled = true; mocks.template.mockResolvedValue(null);
    expect((await call({ file: file(ids) })).status).toBe(404);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('returns the plain parser reason for malformed input', async () => {
    const res = await call({ file: { bosses: [{ name: 'Ragnaros' }] } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This file isn\'t a loot list: "Ragnaros" needs "items": a list of item ids.' });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('rejects Classic in production and conflicting cached sources', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await call({ file: file([1]), source: 'CLASSIC' })).status).toBe(400);
    expect(mocks.template).not.toHaveBeenCalled();
    mocks.cached.mockResolvedValue([{ id: 1, source: 'CLASSIC' }]);
    expect((await call({ file: file([1]) })).status).toBe(400);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('allows Classic outside production and refuses an unknown source', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect((await call({ file: file([1]), source: 'CLASSIC' })).status).toBe(200);
    expect(mocks.refresh.mock.calls[0][1]).toEqual([{ id: 1, source: 'CLASSIC' }]);
    expect((await call({ file: file([1]), source: 'other' })).status).toBe(400);
  });
  it('fetches only 30, resumes from cache, and returns the final preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const started = Date.now();
    const first = await call({ file: file(ids) });
    expect(first.headers.get('cache-control')).toBe('private, no-store');
    expect(await first.json()).toMatchObject({ remaining: 15, preview: null });
    expect(mocks.refresh.mock.calls[0][1]).toEqual(ids.slice(0, 30).map((id) => ({ id, source: 'FOREVER' })));
    const deadline = mocks.refresh.mock.calls[0][2].deadline;
    expect(deadline).toBeGreaterThanOrEqual(started + 40_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 40_000);
    mocks.cached.mockResolvedValue(ids.slice(0, 30).map((id) => ({ id, source: 'FOREVER' })));
    const second = await (await call({ file: file(ids) })).json();
    expect(mocks.refresh.mock.calls[1][1]).toHaveLength(15);
    expect(second).toMatchObject({ remaining: 0, preview: { added: 45, newBosses: 1 } });
    expect(second.preview.bosses[0].add).toEqual(ids);
    expect(second.preview.token).toMatch(/^[a-f0-9]{64}$/);
  });
  it('carries failures in skip and leaves deadline-interrupted items pending', async () => {
    mocks.refresh.mockResolvedValueOnce({ saved: [1], failed: [{ id: 2, error: 'Not found' }], notReached: [3] });
    const first = await (await call({ file: file([1, 2, 3]) })).json();
    expect(first).toMatchObject({ remaining: 1, skip: [2], failed: [{ id: 2, error: 'Not found' }], preview: null });
    mocks.cached.mockResolvedValue([{ id: 1, source: 'FOREVER' }]);
    const last = await (await call({ file: file([1, 2, 3]), skip: [...first.skip, 'bad', 999] })).json();
    expect(mocks.refresh.mock.calls[1][1]).toEqual([{ id: 3, source: 'FOREVER' }]);
    expect(last).toMatchObject({ remaining: 0, skip: [2], preview: { bosses: [{ add: [1, 3], notFound: [2] }] } });
  });
});
