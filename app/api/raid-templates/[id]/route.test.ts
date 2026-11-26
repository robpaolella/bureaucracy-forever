import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: null as { role: string } | null, update: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/db', () => ({ db: { raidTemplate: { update: mocks.update } } }));

import { PATCH } from './route';

const BODY = { name: 'Onyxia', short: 'Ony', size: 40, durationMin: 60, requirements: { tank: 3, healer: 12, melee: 11, ranged: 14 }, active: true };
const patch = (body: unknown) => PATCH(new Request('https://example.test/api/raid-templates/t1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: 't1' }) });

describe('PATCH /api/raid-templates/:id and the instance number', () => {
  beforeEach(() => {
    mocks.session = { role: 'officer' };
    mocks.update.mockReset().mockResolvedValue({ id: 't1', name: 'Onyxia' });
  });

  it('saves, changes and clears the number', async () => {
    await patch({ ...BODY, instance: 249 });
    await patch({ ...BODY, instance: '531' });
    await patch({ ...BODY, instance: '' });
    await patch(BODY);
    expect(mocks.update.mock.calls.map((c) => c[0].data.instance)).toEqual([249, 531, null, null]);
    expect(mocks.update.mock.calls[0][0].where).toEqual({ id: 't1' });
  });

  it('refuses a bad number with the field message and leaves the stored one alone', async () => {
    for (const bad of ['24.9', 0, -5, 99_999_999_999]) {
      const res = await patch({ ...BODY, instance: bad });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'The instance number is a whole number above 0, or leave it blank.' });
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('refuses anyone but an officer', async () => {
    mocks.session = null;
    expect((await patch({ ...BODY, instance: 249 })).status).toBe(401);
    mocks.session = { role: 'member' };
    expect((await patch({ ...BODY, instance: 249 })).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
