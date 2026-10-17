import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ load: vi.fn(), latest: vi.fn(), reminder: vi.fn() }));
vi.mock('@/lib/applications-data', () => ({ loadApplication: store.load }));
vi.mock('@/lib/interviews', () => ({ latestInterview: store.latest }));

vi.mock('@/lib/application-reminders', () => ({ loadReminder: store.reminder }));

import { GET } from './route';

const call = (id = 'a1') =>
  GET(new Request(`https://example.test/api/bot/applications/${id}`, { headers: { authorization: 'Bearer test-secret' } }), { params: Promise.resolve({ id }) });

describe('GET /api/bot/applications/:id interview block', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.load.mockReset().mockResolvedValue({ id: 'a1', discordId: '1', answers: [], notes: [] });
    store.latest.mockReset();
    store.reminder.mockReset().mockResolvedValue({ pending: null, live: null });
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

  it('carries the reminder block, live ids included for a decided application', async () => {
    store.load.mockResolvedValue({ id: 'a1', discordId: '1', status: 'accepted', answers: [], notes: [] });
    store.latest.mockResolvedValue(null);
    store.reminder.mockResolvedValue({ pending: null, live: { channelId: 'c', messageId: 'm' } });
    expect((await (await call()).json()).reminder).toEqual({ pending: null, live: { channelId: 'c', messageId: 'm' } });
    expect(store.reminder).toHaveBeenCalledWith('a1');
  });
});
