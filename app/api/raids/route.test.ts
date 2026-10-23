import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as { role: string; discordId: string } | null,
  findTemplate: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/raid-cards', () => ({ loadRaidCards: vi.fn() }));
vi.mock('@/lib/tick', () => ({ rosterUserIds: async () => [], rosterSignups: async () => [] }));
vi.mock('@/lib/db', () => ({ db: { raidTemplate: { findFirst: mocks.findTemplate }, raid: { create: mocks.create } } }));

import { POST } from './route';

const body = { templateId: 't1', date: '2099-11-04', time: '19:00', durationMin: 180, requirements: { tank: 2, healer: 8, melee: 9, ranged: 11 }, notes: '' };
const post = (over: Record<string, unknown> = {}) => POST(new Request('https://example.test/api/raids', { method: 'POST', body: JSON.stringify({ ...body, ...over }) }));

describe('POST /api/raids', () => {
  beforeEach(() => {
    mocks.session = { role: 'officer', discordId: '1' };
    mocks.findTemplate.mockReset().mockResolvedValue({ id: 't1', name: 'Molten Core' });
    mocks.create.mockReset().mockImplementation(async ({ data }) => ({ id: 'r1', name: data.name, startsAt: data.startsAt }));
  });

  it('refuses a request without a template', async () => {
    const res = await post({ templateId: undefined });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Pick a raid template.' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('refuses an unknown or inactive template', async () => {
    mocks.findTemplate.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Pick a raid template.' });
    expect(mocks.findTemplate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1', active: true } }));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('saves the template and names the event from it in guild time', async () => {
    const res = await post();
    expect(res.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ templateId: 't1', name: 'Molten Core — Wed Nov 4' });
  });

  it('ignores a typed name', async () => {
    await post({ name: 'Something else' });
    expect(mocks.create.mock.calls[0][0].data.name).toBe('Molten Core — Wed Nov 4');
  });

  it('stores the switch, and yes when it is left out', async () => {
    await post({ reservesAllowed: false });
    expect(mocks.create.mock.calls[0][0].data.reservesAllowed).toBe(false);
    await post({ reservesAllowed: true });
    expect(mocks.create.mock.calls[1][0].data.reservesAllowed).toBe(true);
    await post();
    expect(mocks.create.mock.calls[2][0].data.reservesAllowed).toBe(true);
  });

  it('refuses a switch that is not on or off', async () => {
    expect((await post({ reservesAllowed: 'no' })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('accepts template lengths and refuses others', async () => {
    expect((await post({ durationMin: 45 })).status).toBe(201);
    expect((await post({ durationMin: 420 })).status).toBe(201);
    for (const durationMin of [20, 500, 100]) expect((await post({ durationMin })).status).toBe(400);
  });

  it('is for officers only', async () => {
    mocks.session = { role: 'member', discordId: '2' };
    expect((await post()).status).toBe(403);
  });
});
