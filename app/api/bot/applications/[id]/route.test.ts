import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ load: vi.fn(), latest: vi.fn() }));
vi.mock('@/lib/applications-data', () => ({ loadApplication: store.load }));
vi.mock('@/lib/interviews', () => ({ latestInterview: store.latest }));

import { GET } from './route';

const call = (id = 'a1') =>
  GET(new Request(`https://example.test/api/bot/applications/${id}`, { headers: { authorization: 'Bearer test-secret' } }), { params: Promise.resolve({ id }) });

describe('GET /api/bot/applications/:id interview block', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.load.mockReset().mockResolvedValue({ id: 'a1', discordId: '1', answers: [], notes: [] });
    store.latest.mockReset();
  });

  it('is null when there is no interview', async () => {
    store.latest.mockResolvedValue(null);
    const body = await (await call()).json();
    expect(body.interview).toBeNull();
    expect(store.latest).toHaveBeenCalledWith('a1');
  });

  it('carries an active attempt', async () => {
    store.latest.mockResolvedValue({ id: 'i1', attempt: 1, status: 'BOOKED' });
    expect((await (await call()).json()).interview).toEqual({ id: 'i1', attempt: 1, status: 'BOOKED' });
  });

  it('carries the latest attempt once ended', async () => {
    store.latest.mockResolvedValue({ id: 'i2', attempt: 2, status: 'CANCELLED' });
    expect((await (await call()).json()).interview).toEqual({ id: 'i2', attempt: 2, status: 'CANCELLED' });
  });

  it('404 for an unknown application without reading interviews', async () => {
    store.load.mockResolvedValue(null);
    expect((await call('zzz')).status).toBe(404);
    expect(store.latest).not.toHaveBeenCalled();
  });
});
