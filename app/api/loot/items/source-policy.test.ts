import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOREVER_ONLY, SOURCE_CONFLICT } from '@/lib/item-sources';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), createEntry: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
vi.mock('@/lib/db', () => ({ db: {
  lootItem: { findUnique: mocks.findUnique, findMany: mocks.findMany, upsert: mocks.upsert },
  lootBoss: { findUnique: async () => ({ id: 'b1' }) },
  lootTableEntry: { create: mocks.createEntry, findFirst: async () => null },
} }));

import { POST as refresh } from './refresh/route';
import { POST as add } from '../bosses/[bossId]/items/route';

const request = (body: unknown) => new Request('https://example.test/api/loot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const fetcher = vi.fn();

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubGlobal('fetch', fetcher);
  vi.clearAllMocks();
  mocks.findUnique.mockReset();
  mocks.upsert.mockReset().mockResolvedValue({});
  fetcher.mockReset().mockImplementation(async () => new Response(JSON.stringify({ name: 'A', quality: 2, icon: 'a', tooltip: '' })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('item routes with the real shared source guard', () => {
  it('refuses a single Classic refresh in production with a plain message and no write', async () => {
    mocks.findUnique.mockResolvedValue({ id: 1, source: 'CLASSIC' });
    const res = await refresh(request({ itemId: 1 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: FOREVER_ONLY });
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('reports Classic batch failures while fetching only Forever in production', async () => {
    mocks.findMany.mockResolvedValue([{ id: 1, source: 'CLASSIC' }, { id: 2, source: 'FOREVER' }]);
    mocks.findUnique.mockResolvedValue({ source: 'FOREVER' });
    const res = await refresh(request({ templateId: 't1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ saved: 1, failed: [{ id: 1, error: FOREVER_ONLY }], remaining: 0 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('https://nether.wowhead.com/forever/tooltip/item/2', expect.anything());
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it.each(['CLASSIC', 'FOREVER'] as const)('refuses a refresh when the stored source differs from the selected %s target', async (source) => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    mocks.findUnique.mockResolvedValueOnce({ id: 1, source }).mockResolvedValue({ source: source === 'CLASSIC' ? 'FOREVER' : 'CLASSIC' });
    const res = await refresh(request({ itemId: 1 }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: `Wowhead: ${SOURCE_CONFLICT}` });
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it.each(['conditional upsert', 'unique violation'])('does not add a table entry if another game claims the id during the fetch (%s)', async (mode) => {
    mocks.findUnique.mockResolvedValue(null);
    if (mode === 'conditional upsert') mocks.upsert.mockResolvedValue(null);
    else mocks.upsert.mockRejectedValue({ code: 'P2002' });
    const res = await add(request({ ref: '1', source: 'FOREVER' }), { params: Promise.resolve({ bossId: 'b1' }) });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: `Wowhead: ${SOURCE_CONFLICT}` });
    expect(mocks.createEntry).not.toHaveBeenCalled();
    expect(mocks.upsert.mock.calls[0][0].where).toEqual({ id: 1, source: 'FOREVER' });
  });
});
