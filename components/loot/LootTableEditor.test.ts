import { describe, expect, it } from 'vitest';
import { itemTag } from './LootTableEditor';

describe('itemTag', () => {
  const limits = { 10: 3, 30: 5 };

  it('shows the win limit only above 1', () => {
    expect(itemTag(10, new Set(), limits)).toBe('Win limit 3');
    expect(itemTag(20, new Set(), limits)).toBeNull();
    expect(itemTag(20, new Set(), { 20: 1 })).toBeNull();
  });

  it('shows only the block on a blocked item, whatever its limit', () => {
    expect(itemTag(30, new Set([30]), limits)).toBe('Not open to reserves');
    expect(itemTag(20, new Set([20]), limits)).toBe('Not open to reserves');
  });
});
