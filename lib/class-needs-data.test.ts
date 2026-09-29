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
    await setClassNeed({ wowClass: 'druid', spec: 'Feral', status: 'high' });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { class_spec: { class: 'DRUID', spec: 'Feral' } },
      create: { class: 'DRUID', spec: 'Feral', roles: ['TANK', 'MELEE'], status: 'HIGH' },
      update: { status: 'HIGH', roles: ['TANK', 'MELEE'] },
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith('class-needs', 'max');
  });
});

describe('readNeedRowsUncached', () => {
  it('maps stored rows to lower-case need rows', async () => {
    mocks.findMany.mockResolvedValue([{ class: 'MAGE', spec: 'Frost', status: 'MEDIUM' }]);
    expect(await readNeedRowsUncached()).toEqual([{ wowClass: 'mage', spec: 'Frost', status: 'medium' }]);
  });
});
