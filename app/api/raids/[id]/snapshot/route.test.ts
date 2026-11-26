import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { role: 'officer', discordId: 'd9' } as { role: string; discordId: string } | null,
  loot: true,
  raid: vi.fn(),
  load: vi.fn(),
  lines: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot }));
vi.mock('@/lib/db', () => ({ db: { raid: { findUnique: mocks.raid } } }));
vi.mock('@/lib/addon-snapshot', () => ({ loadSnapshot: mocks.load }));
vi.mock('@/lib/addon-snapshot-text', () => ({ snapshotLines: mocks.lines }));

import { GET } from './route';

const get = () => GET(new Request('https://example.test'), { params: Promise.resolve({ id: 'r1' }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = { role: 'officer', discordId: 'd9' };
  mocks.loot = true;
  mocks.raid.mockResolvedValue({ cancelledAt: null });
  mocks.load.mockResolvedValue({ raid: 'r1' });
  mocks.lines.mockReturnValue(['BFSNAP1:1/2:a', 'BFSNAP1:2/2:b']);
});

describe('GET /api/raids/[id]/snapshot', () => {
  it('gives an officer every part, built from one snapshot', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ parts: ['BFSNAP1:1/2:a', 'BFSNAP1:2/2:b'] });
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith('r1');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each([['member'], ['social']])('refuses a %s', async (role) => {
    mocks.session = { role, discordId: 'd1' };
    expect((await get()).status).toBe(403);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('refuses a signed-out request', async () => {
    mocks.session = null;
    expect((await get()).status).toBe(401);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('refuses when loot is off', async () => {
    mocks.loot = false;
    expect((await get()).status).toBe(404);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('refuses a cancelled raid', async () => {
    mocks.raid.mockResolvedValue({ cancelledAt: new Date() });
    expect((await get()).status).toBe(409);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('answers 404 for a raid that does not exist', async () => {
    mocks.raid.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it('answers 404 when the raid is deleted after the check', async () => {
    mocks.load.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});
