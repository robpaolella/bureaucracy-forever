import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as object[], findMany: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { raid: { findMany: mocks.findMany } } }));

import { listHelperRaids } from './helper-raids';

const now = new Date('2026-10-16T20:00:00Z');
const row = (id: string, template: object | null) => ({ id, name: id, startsAt: now, durationMin: 180, cancelledAt: null, template });

beforeEach(() => mocks.findMany.mockImplementation(async () => mocks.rows));

describe('listHelperRaids and the template instance number', () => {
  it('forwards the template instance when set, and leaves it out when unset or the template is gone', async () => {
    mocks.rows = [row('cmraid0000set', { instance: 249, lootBosses: [] }), row('cmraid000unset', { instance: null, lootBosses: [] }), row('cmraid0nolink', null)];
    const [set, unset, gone] = await listHelperRaids('production', now);
    expect(set.instance).toBe(249);
    expect('instance' in unset).toBe(false);
    expect('instance' in gone).toBe(false);
  });
});

describe('listHelperRaids and the Reserves allowed switch', () => {
  it('marks a raid with a loot table whatever the switch says, because it never reads it', async () => {
    mocks.rows = [row('cmraid0000set', { instance: 249, lootBosses: [{ id: 'lb1' }] })];
    expect((await listHelperRaids('production', now))[0].hasLootTable).toBe(true);
    expect(JSON.stringify(mocks.findMany.mock.calls[0][0])).not.toMatch(/reserve/i);
  });
});
