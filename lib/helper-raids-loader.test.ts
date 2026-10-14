import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as object[] }));
vi.mock('@/lib/db', () => ({ db: { raid: { findMany: async () => mocks.rows } } }));

import { listHelperRaids } from './helper-raids';

const now = new Date('2026-10-16T20:00:00Z');
const row = (id: string, template: object | null) => ({ id, name: id, startsAt: now, durationMin: 180, cancelledAt: null, template });

describe('listHelperRaids and the template instance number', () => {
  it('forwards the template instance when set, and leaves it out when unset or the template is gone', async () => {
    mocks.rows = [row('cmraid0000set', { instance: 249, lootBosses: [] }), row('cmraid000unset', { instance: null, lootBosses: [] }), row('cmraid0nolink', null)];
    const [set, unset, gone] = await listHelperRaids('production', now);
    expect(set.instance).toBe(249);
    expect('instance' in unset).toBe(false);
    expect('instance' in gone).toBe(false);
  });
});
