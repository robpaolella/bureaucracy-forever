import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ templateFind: vi.fn(), create: vi.fn(), generate: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer', discordId: '1' }) }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'u1' }) }));
vi.mock('@/lib/db', () => ({ db: { raidTemplate: { findUnique: mocks.templateFind }, raidSeries: { create: mocks.create } } }));
vi.mock('@/lib/tick', () => ({ generateInstances: mocks.generate, rosterUserIds: async () => [] }));

import { POST } from './route';

const body = { templateId: 't1', weekday: 2, startTime: '20:00', durationMin: 180 };
const post = (over: Record<string, unknown> = {}) => POST(new Request('https://example.test/api/raid-series', { method: 'POST', body: JSON.stringify({ ...body, ...over }) }));

describe('POST /api/raid-series title addition', () => {
  beforeEach(() => {
    mocks.templateFind.mockReset().mockResolvedValue({ id: 't1', name: 'Upper Blackrock Spire', active: true });
    mocks.create.mockReset().mockResolvedValue({ id: 's1' });
    mocks.generate.mockReset().mockResolvedValue(4);
  });

  it('stores the tidied addition on the series', async () => {
    expect((await post({ titleAddition: ' Key  Run ' })).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.titleAddition).toBe('Key Run');
  });

  it('stores none when it is left out', async () => {
    await post();
    expect(mocks.create.mock.calls[0][0].data.titleAddition).toBeNull();
  });

  it('refuses one that could make a title over 100 characters', async () => {
    mocks.templateFind.mockResolvedValue({ id: 't1', name: 'T'.repeat(60), active: true });
    const res = await post({ titleAddition: 'x'.repeat(26) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/100 characters or fewer/);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
