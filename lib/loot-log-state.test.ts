import { describe, expect, it } from 'vitest';
import { mergeAwards, type LocalAward } from './loot-log-state';

const local = (id: string, method: LocalAward['method'] = 'HR'): LocalAward => ({ id, itemId: 100, userId: 'u1', characterId: 'c1', method });

describe('mergeAwards', () => {
  it('adds local records the server does not show yet, and their HR wins', () => {
    const out = mergeAwards([{ id: 'a', itemId: 5, userId: 'u9' }], [], [local('b')], new Set());
    expect(out.raidAwards.map((a) => a.id)).toEqual(['a', 'b']);
    expect(out.hrAwards).toEqual([{ id: 'b', characterId: 'c1', itemId: 100 }]);
  });

  it('uses the server rows once they arrive', () => {
    const out = mergeAwards([{ id: 'b', itemId: 100, userId: 'u1' }], [{ id: 'b', characterId: 'c1', itemId: 100 }], [local('b')], new Set());
    expect(out.raidAwards).toEqual([{ id: 'b', itemId: 100, userId: 'u1' }]);
    expect(out.hrAwards).toEqual([{ id: 'b', characterId: 'c1', itemId: 100 }]);
  });

  it('drops what was voided here from both lists, server rows included', () => {
    const out = mergeAwards([{ id: 'a', itemId: 5, userId: 'u9' }], [{ id: 'a', characterId: 'c9', itemId: 5 }], [local('b')], new Set(['a', 'b']));
    expect(out).toEqual({ raidAwards: [], hrAwards: [] });
  });

  it('only counts HR wins with a character as HR blocks', () => {
    expect(mergeAwards([], [], [local('b', 'SR'), { ...local('c', 'DISENCHANT_BANK'), characterId: null, userId: null }], new Set()).hrAwards).toEqual([]);
  });
});
