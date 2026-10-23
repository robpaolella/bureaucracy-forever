import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as { role: string } | null,
  findUnique: vi.fn(),
  findTemplate: vi.fn(),
  update: vi.fn(),
  setReservesAllowed: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/loot-blocks', () => ({ setReservesAllowed: mocks.setReservesAllowed }));
vi.mock('@/lib/outbox', () => ({ enqueue: vi.fn() }));
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { raid: { findUnique: mocks.findUnique, update: mocks.update }, raidTemplate: { findFirst: mocks.findTemplate } } }));

import { PATCH } from './route';

const form = { date: '2099-11-04', time: '19:00', durationMin: 180, requirements: { tank: 2, healer: 8, melee: 9, ranged: 11 }, notes: 'n' };
const raid = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  startsAt: new Date('2099-10-01T03:00:00.000Z'),
  durationMin: 180,
  cancelledAt: null,
  discordThreadId: null,
  locksAt: new Date('2099-10-01T01:00:00.000Z'),
  templateId: 't1',
  template: { name: 'Molten Core' },
  ...over,
});
const patch = (over: Record<string, unknown> = {}) => PATCH(new Request('https://example.test/api/raids/r1', { method: 'PATCH', body: JSON.stringify({ ...form, ...over }) }), { params: Promise.resolve({ id: 'r1' }) });

describe('PATCH /api/raids/[id] (edit)', () => {
  beforeEach(() => {
    mocks.session = { role: 'officer' };
    mocks.findUnique.mockReset().mockResolvedValue(raid());
    mocks.setReservesAllowed.mockReset().mockResolvedValue(true);
    mocks.findTemplate.mockReset().mockResolvedValue({ name: 'Onyxia' });
    mocks.update.mockReset().mockImplementation(async ({ data }) => ({ id: 'r1', name: data.name, startsAt: data.startsAt, discordThreadId: null }));
  });

  it('keeps the template when the body leaves it out, and renames from the new date', async () => {
    const res = await patch();
    expect(res.status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ templateId: 't1', name: 'Molten Core — Wed Nov 4' });
  });

  it('accepts the same template id', async () => {
    expect((await patch({ templateId: 't1' })).status).toBe(200);
  });

  it('refuses a different template and changes nothing', async () => {
    const res = await patch({ templateId: 't2' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "A raid's template can't be changed. Delete it and schedule it again." });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('uses the template’s current name on a notes-only edit', async () => {
    mocks.findUnique.mockResolvedValue(raid({ template: { name: 'Molten Core (renamed)' }, startsAt: new Date('2099-11-05T03:00:00.000Z'), locksAt: new Date('2099-11-05T01:00:00.000Z') }));
    await patch();
    expect(mocks.update.mock.calls[0][0].data.name).toBe('Molten Core (renamed) — Wed Nov 4');
  });

  it('edits an event whose template is now inactive without looking it up', async () => {
    expect((await patch()).status).toBe(200);
    expect(mocks.findTemplate).not.toHaveBeenCalled();
  });

  describe('reserves allowed', () => {
    it('switches it off through the setter, which takes the reserve lock', async () => {
      expect((await patch({ reservesAllowed: false })).status).toBe(200);
      expect(mocks.setReservesAllowed).toHaveBeenCalledWith('r1', false);
      expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty('reservesAllowed');
    });

    it('switches it on through the setter', async () => {
      await patch({ reservesAllowed: true });
      expect(mocks.setReservesAllowed).toHaveBeenCalledWith('r1', true);
    });

    it('keeps the stored value when the body leaves it out', async () => {
      expect((await patch()).status).toBe(200);
      expect(mocks.setReservesAllowed).not.toHaveBeenCalled();
    });

    it('refuses a value that is not on or off, and changes nothing', async () => {
      const res = await patch({ reservesAllowed: 'no' });
      expect(res.status).toBe(400);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.setReservesAllowed).not.toHaveBeenCalled();
    });

    it('says so when the raid was deleted meanwhile', async () => {
      mocks.setReservesAllowed.mockResolvedValue(false);
      expect((await patch({ reservesAllowed: false })).status).toBe(404);
    });
  });

  it('ignores a typed name', async () => {
    await patch({ name: 'Typed' });
    expect(mocks.update.mock.calls[0][0].data.name).toBe('Molten Core — Wed Nov 4');
  });

  describe('an event with no template', () => {
    beforeEach(() => mocks.findUnique.mockResolvedValue(raid({ templateId: null, template: null })));

    it('needs one picked', async () => {
      const res = await patch();
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Pick a raid template.' });
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('refuses an unknown or inactive one', async () => {
      mocks.findTemplate.mockResolvedValue(null);
      expect((await patch({ templateId: 'gone' })).status).toBe(400);
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('gets the template and the name', async () => {
      expect((await patch({ templateId: 't2' })).status).toBe(200);
      expect(mocks.update.mock.calls[0][0].data).toMatchObject({ templateId: 't2', name: 'Onyxia — Wed Nov 4' });
    });
  });
});
