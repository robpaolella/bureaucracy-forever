import { describe, expect, it } from 'vitest';
import { atlasLootSettings } from './config';
import { ATLASLOOT_DATA_URL } from './loot-import';

describe('atlasLootSettings', () => {
  it('defaults to the pinned commit and the Classic item database', () => {
    expect(atlasLootSettings({})).toEqual({ dataUrl: ATLASLOOT_DATA_URL, itemSource: 'CLASSIC' });
    expect(atlasLootSettings({ ATLASLOOT_DATA_URL: '  ', ATLASLOOT_ITEM_SOURCE: '' })).toEqual({ dataUrl: ATLASLOOT_DATA_URL, itemSource: 'CLASSIC' });
  });

  it('takes a configured address and Forever, whatever the case', () => {
    expect(atlasLootSettings({ ATLASLOOT_DATA_URL: 'https://example.test/data.lua', ATLASLOOT_ITEM_SOURCE: 'forever' }))
      .toEqual({ dataUrl: 'https://example.test/data.lua', itemSource: 'FOREVER' });
  });

  it('falls back to Classic for an unrecognised item database, which production refuses', () => {
    expect(atlasLootSettings({ ATLASLOOT_ITEM_SOURCE: 'retail' }).itemSource).toBe('CLASSIC');
  });
});
