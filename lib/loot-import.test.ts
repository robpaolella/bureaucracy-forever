import { describe, expect, it } from 'vitest';
import { allItemIds, parseAtlasLoot, parseIdsFile } from './loot-import';

// Trimmed from AtlasLootClassic_DungeonsAndRaids/data.lua at the pinned commit, with a
// string entry and a block comment added to exercise the skips.
const LUA = `
data["Onyxia"] = { items = { { name = AL["Onyxia"], [NORMAL_DIFF] = { { 1, 99999 } } } } }

data["MoltenCore"] = {
	MapID = 2717,
	ContentType = RAID40_CONTENT,
	items = {
		{	--MCLucifron
			name = AL["Lucifron"],
			npcID = 12118,
			DisplayIDs = {{13031},{12030}},
			[NORMAL_DIFF] = {
				{ 1, 16800 },	-- Arcanist Boots
				{ 2, 16805 },	-- Felheart Gloves
				{ 16, 18870 },	-- Helm of the Lifegiver
				{ 17, "INV_Box_01" }, -- a header, not an item
			},
		},
		--[[ a commented-out boss { name = AL["Ghost"], [NORMAL_DIFF] = { { 1, 1 } } } ]]
		{ -- MCRagnaros
			name = AL["Ragnaros"],
			[NORMAL_DIFF] = {
				{ 1, 17204 }, -- Eye of Sulfuras
				{ 16, 18870 },
				{ 27, 17076 }, -- Bonereaver's Edge
			},
		},
		{ -- MCRANDOMBOSSDROPS
			name = AL["All bosses"],
			ExtraList = true,
			[NORMAL_DIFF] = {
				{ 1,  18264 }, -- Plans: Elemental Sharpening Stone
			},
		},
		{ -- MCTrashMobs
			name = AL["Trash"],
			ExtraList = true,
			[NORMAL_DIFF] = {
				{ 1,  16817 }, -- Girdle of Prophecy
				{ 12, 17011 }, -- Lava Core
			},
		},
		T1_SET,
	}
}
`;

describe('parseAtlasLoot', () => {
  it('reads bosses in order with their item ids, trash flagged', () => {
    const { bosses } = parseAtlasLoot(LUA, 'MoltenCore');
    expect(bosses).toEqual([
      { name: 'Lucifron', isTrash: false, itemIds: [16800, 16805, 18870] },
      { name: 'Ragnaros', isTrash: false, itemIds: [17204, 18870, 17076] },
      { name: 'All bosses', isTrash: false, itemIds: [18264] },
      { name: 'Trash', isTrash: true, itemIds: [16817, 17011] },
    ]);
  });

  it('reports what it skipped', () => {
    expect(parseAtlasLoot(LUA, 'MoltenCore').skipped).toEqual(['Lucifron: "INV_Box_01"', 'T1_SET (a shared set, not boss loot)']);
  });

  it('reads only the raid asked for and refuses unknown keys', () => {
    expect(parseAtlasLoot(LUA, 'Onyxia').bosses).toEqual([{ name: 'Onyxia', isTrash: false, itemIds: [99999] }]);
    expect(() => parseAtlasLoot(LUA, 'Naxxramas')).toThrow('No data["Naxxramas"]');
  });

  it('handles strings, long comments, other difficulties and empty bosses', () => {
    const lua = `data["X"] = { items = {
      "a stray string",
      { name = AL["A -- } B"], [NORMAL_DIFF] = { { 1, 10 }, { 2, 0x10 }, { 3, 1e3 } } },
      --[==[ { name = AL["Hidden"], [NORMAL_DIFF] = { { 1, 1 } } } ]==]
      { name = AL["Say \\"hi\\""], [RAID40_DIFF] = { { 1, 20 } } },
      { name = AL["Empty"], [NORMAL_DIFF] = { { 1, "INV_Box" } } },
    } }`;
    const { bosses, skipped } = parseAtlasLoot(lua, 'X');
    expect(bosses).toEqual([
      { name: 'A -- } B', isTrash: false, itemIds: [10] },
      { name: 'Say "hi"', isTrash: false, itemIds: [20] },
    ]);
    expect(skipped).toEqual(['A -- } B: 0x10', 'A -- } B: 1e3', 'Empty: "INV_Box"', 'Empty (no item ids)']);
  });

  it('throws on unbalanced braces', () => {
    expect(() => parseAtlasLoot('data["X"] = { items = { { name = AL["A"] }', 'X')).toThrow('Unbalanced braces');
  });

  it('lists every item once', () => {
    expect(allItemIds(parseAtlasLoot(LUA, 'MoltenCore'))).toEqual([16800, 16805, 18870, 17204, 17076, 18264, 16817, 17011]);
  });
});

describe('parseIdsFile', () => {
  it('reads bosses and a trash entry, deduplicating ids', () => {
    expect(parseIdsFile({ bosses: [{ name: ' Lucifron ', items: [1, 2, 2] }, { name: 'Trash', trash: true, items: [3] }] })).toEqual({
      skipped: [],
      bosses: [
        { name: 'Lucifron', isTrash: false, itemIds: [1, 2] },
        { name: 'Trash', isTrash: true, itemIds: [3] },
      ],
    });
  });

  it.each([
    [{}, 'non-empty "bosses"'],
    [{ bosses: [{ items: [1] }] }, 'Boss 1 has no name.'],
    [{ bosses: [{ name: 'A', items: ['1'] }] }, '"A" needs "items"'],
    [{ bosses: [{ name: 'A', items: [1] }, { name: 'A', items: [2] }] }, '"A" is listed twice.'],
  ])('refuses %j', (json, message) => {
    expect(() => parseIdsFile(json)).toThrow(message);
  });
});
