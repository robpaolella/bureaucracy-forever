import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allItemIds, listAtlasRaids, listForeverDungeons, matchAtlasRaid, parseAtlasLoot, parseForeverDungeon, parseIdsFile } from './loot-import';
import { toIdsFile } from './loot-load-client';

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
    [{ bosses: [{ items: [1] }] }, 'boss 1 needs a name.'],
    [{ bosses: [{ name: 'A', items: ['1'] }] }, '"A" needs "items"'],
    [{ bosses: [{ name: 'A', items: [1] }, { name: 'A', items: [2] }] }, '"A" is listed twice.'],
  ])('refuses %j', (json, message) => {
    expect(() => parseIdsFile(json)).toThrow(message);
  });
});

describe('parseAtlasLoot keys', () => {
  it('finds a raid whose key has an apostrophe, as listAtlasRaids offers it', () => {
    const lua = 'data["Zul\'Gurub"] = { ContentType = RAID20_CONTENT, items = { { name = AL["Venoxis"], [NORMAL_DIFF] = { { 1, 19900 } } } } }';
    expect(listAtlasRaids(lua).map((r) => r.key)).toEqual(["Zul'Gurub"]);
    expect(parseAtlasLoot(lua, "Zul'Gurub").bosses).toEqual([{ name: 'Venoxis', isTrash: false, itemIds: [19900] }]);
  });

  it('treats the key as exact text, not a pattern', () => {
    expect(() => parseAtlasLoot('data["Onyxia"] = { items = {} }', '.*')).toThrow();
  });
});

describe('listAtlasRaids', () => {
  const lua = `
local RAID40_CONTENT = data:AddContentType(AL["40 Raids"], X)
data["Ragefire"] = { ContentType = DUNGEON_CONTENT, items = {} }
data["MoltenCore"] = { MapID = 1, ContentType = RAID40_CONTENT, items = {} }
-- data["Ghost"] = { ContentType = RAID40_CONTENT }
data["Onyxia"] = { ContentType = RAID40_CONTENT, items = {} }
data["Zul'Gurub"] = { ContentType = RAID20_CONTENT, items = {} }
data["TheRuinsofAhnQiraj"] = { -- AQ20
  ContentType = RAID20_CONTENT, items = {} }
data["WorldBosses"] = { ContentType = RAID40_CONTENT, items = {} }
`;

  it('lists raids only, in file order, with names that read like the tiers', () => {
    expect(listAtlasRaids(lua)).toEqual([
      { key: 'MoltenCore', name: 'Molten Core' },
      { key: 'Onyxia', name: 'Onyxia’s Lair' },
      { key: 'Zul\'Gurub', name: 'Zul\'Gurub' },
      { key: 'TheRuinsofAhnQiraj', name: 'Ruins of Ahn’Qiraj' },
    ]);
  });

  it('is empty for data with no raids', () => expect(listAtlasRaids('')).toEqual([]));
});

describe('matchAtlasRaid', () => {
  const raids = listAtlasRaids('data["MoltenCore"] = { ContentType = RAID40_CONTENT }\ndata["Onyxia"] = { ContentType = RAID40_CONTENT }\ndata["TheRuinsofAhnQiraj"] = { ContentType = RAID20_CONTENT }');

  it('matches the tier name, ignoring case, punctuation and a leading "The"', () => {
    expect(matchAtlasRaid(raids, 'molten core')?.key).toBe('MoltenCore');
    expect(matchAtlasRaid(raids, 'Onyxia\'s Lair')?.key).toBe('Onyxia');
    expect(matchAtlasRaid(raids, 'The Ruins of Ahn\'Qiraj')?.key).toBe('TheRuinsofAhnQiraj');
  });

  it('chooses nothing when no name matches', () => {
    expect(matchAtlasRaid(raids, 'Karazhan')).toBeNull();
    expect(matchAtlasRaid(raids, '')).toBeNull();
  });
});

describe('foreverchanges.pro', () => {
  const page = (name: string) => readFileSync(join(process.cwd(), 'lib/__fixtures__/foreverchanges', `${name}.html`), 'utf8');

  describe('listForeverDungeons', () => {
    it('lists each slug once, without fragments, with its decoded name', () => {
      const list = listForeverDungeons(page('dungeons-index'));
      expect(list.map((d) => d.slug)).toEqual(['hall-of-thanes', 'the-deadmines', 'shadowfang-keep', 'kroldok-stronghold', 'zulfarrak', 'ragefire-chasm', 'ruins-of-lordaeron', 'wailing-caverns']);
      expect(list.find((d) => d.slug === 'zulfarrak')?.name).toBe('Zul\'Farrak');
      expect(list.every((d) => !d.slug.includes('#'))).toBe(true);
    });

    it('is empty for a page with no dungeons', () => {
      expect(listForeverDungeons('<html></html>')).toEqual([]);
    });
  });

  describe('parseForeverDungeon', () => {
    it('converts a normal dungeon: bosses in page order, one Trash row, green and better only', () => {
      const table = parseForeverDungeon(page('the-deadmines'));
      const names = table.bosses.map((b) => b.name);
      expect(names.slice(0, 3)).toEqual(['Rhahk\'Zor', 'Miner Johnson', 'Sneed']);
      expect(names.filter((n) => n === 'Trash')).toHaveLength(1);
      expect(table.bosses.find((b) => b.name === 'Trash')?.isTrash).toBe(true);
      expect(table.bosses.find((b) => b.name === 'Rhahk\'Zor')?.itemIds).toEqual([872, 5187, 273289, 251363]);
      // Edwin VanCleef has a common item (q 1) among six; it is dropped.
      expect(table.bosses.find((b) => b.name === 'Edwin VanCleef')?.itemIds).toHaveLength(5);
    });

    it('passes the file-shape parser Load table’s preview uses', () => {
      const table = parseForeverDungeon(page('the-deadmines'));
      expect(parseIdsFile(JSON.parse(JSON.stringify(toIdsFile(table))))).toEqual(table);
    });

    it('keeps rare monsters on their own rows', () => {
      const names = parseForeverDungeon(page('shadowfang-keep')).bosses.map((b) => b.name);
      expect(names).toContain('Deathsworn Captain');
      expect(names.indexOf('Deathsworn Captain')).toBe(names.indexOf('Odo the Blindwatcher') + 1);
    });

    it('puts several trash groups on one Trash row where the first sits, dropping grey items', () => {
      const table = parseForeverDungeon(page('multi-trash'));
      const names = table.bosses.map((b) => b.name);
      expect(names.filter((n) => n === 'Trash')).toHaveLength(1);
      expect(names.indexOf('Trash')).toBe(1);
      const trash = table.bosses[1];
      expect(trash.isTrash).toBe(true);
      expect(new Set(trash.itemIds).size).toBe(trash.itemIds.length);
      expect(trash.itemIds).not.toContain(99001);
    });

    it('lists a duplicate item id once on a row', () => {
      expect(parseForeverDungeon(page('duplicate-items')).bosses).toEqual([{ name: 'Twin', isTrash: false, itemIds: [100, 101] }]);
    });

    it.each([
      ['a missing quality', 'missing-quality', /no quality/],
      ['a missing item id', 'missing-item-id', /no item id/],
      ['malformed embedded data', 'malformed', /couldn’t be read/],
      ['a partly recognised page', 'partial', /Mystery.*doesn’t know/],
      ['a page with no embedded data', 'no-data', /no boss data/],
      ['a dungeon with only grey and white items', 'no-items', /no green or better items/],
    ])('fails whole on %s', (_label, name, message) => {
      expect(() => parseForeverDungeon(page(name))).toThrow(message);
    });

    it('fails whole when the page’s copies of the data disagree', () => {
      const html = page('duplicate-items');
      const changed = html.replace('</body>', '<script>self.__next_f.push([1,"{\\"bosses\\":[{\\"name\\":\\"Other\\",\\"kind\\":\\"boss\\",\\"items\\":[]}]}"])</script></body>');
      expect(() => parseForeverDungeon(changed)).toThrow(/differ/);
    });

    it('fails on a repeated row name rather than overwrite one', () => {
      expect(() => parseForeverDungeon(page('the-deadmines').replace(/Cookie/g, 'Sneed'))).toThrow(/listed twice/);
    });
  });
});
