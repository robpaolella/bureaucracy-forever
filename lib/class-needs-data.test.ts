import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), findMany: vi.fn(), revalidateTag: vi.fn() }));

vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag, unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/db', () => ({ db: { classNeed: { upsert: mocks.upsert, findMany: mocks.findMany } } }));

import { readNeedRowsUncached, setClassNeed } from './class-needs-data';

describe('setClassNeed', () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
    mocks.revalidateTag.mockReset();
  });

  it('upserts the row with the spec roles and expires the needs cache', async () => {
    await setClassNeed({ wowClass: 'druid', spec: 'Feral Tank', status: 'high' });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { class_spec: { class: 'DRUID', spec: 'Feral Tank' } },
      create: { class: 'DRUID', spec: 'Feral Tank', roles: ['TANK'], status: 'HIGH' },
      update: { status: 'HIGH', roles: ['TANK'] },
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith('class-needs', 'max');
  });

  it('takes the home-page star off a spec that leaves high need, from the web or /recruitment', async () => {
    await setClassNeed({ wowClass: 'druid', spec: 'Feral Melee DPS', status: 'medium' });
    expect(mocks.upsert.mock.calls[0][0].update).toEqual({ status: 'MEDIUM', roles: ['MELEE'], featured: false });
    await setClassNeed({ wowClass: 'druid', spec: 'Feral Tank', status: 'closed' });
    expect(mocks.upsert.mock.calls[1][0].update).toMatchObject({ status: 'CLOSED', featured: false });
  });
});

describe('readNeedRowsUncached', () => {
  it('maps stored rows to lower-case need rows', async () => {
    mocks.findMany.mockResolvedValue([{ class: 'MAGE', spec: 'Frost', status: 'MEDIUM', featured: false }]);
    expect(await readNeedRowsUncached()).toEqual([{ wowClass: 'mage', spec: 'Frost', status: 'medium', featured: false }]);
  });
});
