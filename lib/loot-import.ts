/**
 * Loot table sources for prisma/import-loot.ts. Pure, so the parsing is unit-tested.
 *
 * AtlasLootClassic keeps each raid as `data["MoltenCore"] = { … items = { {boss}, … } }`,
 * where a boss block has `name = AL["Lucifron"]` and a difficulty table of
 * `{ slot, itemId }` pairs. Set references (`T1_SET`) and non-numeric entries are skipped.
 * WoW Forever loot will come as a plain JSON list of item ids per boss instead.
 */

/** The AtlasLootClassic commit the importer reads; bump deliberately. */
export const ATLASLOOT_COMMIT = '8e99341e4e779328460bf7684c0d5b22ce50ddf1';
export const ATLASLOOT_DATA_URL = `https://raw.githubusercontent.com/Hoizame/AtlasLootClassic/${ATLASLOOT_COMMIT}/AtlasLootClassic_DungeonsAndRaids/data.lua`;

export type AtlasRaid = { key: string; name: string };

/** AtlasLoot keys are camel-cased ids with no display names; these read as the tier names do. */
const RAID_NAMES: Record<string, string> = {
  Onyxia: 'Onyxia’s Lair',
  TheRuinsofAhnQiraj: 'Ruins of Ahn’Qiraj',
  TheTempleofAhnQiraj: 'Temple of Ahn’Qiraj',
};
/** World bosses are in the raid content type but are not a raid tier. */
const NOT_A_TIER = new Set(['WorldBosses']);

/** The raids in AtlasLoot's data.lua (blocks whose ContentType is a raid), in file order. */
export function listAtlasRaids(lua: string): AtlasRaid[] {
  const src = stripComments(lua);
  const raids: AtlasRaid[] = [];
  for (const m of src.matchAll(/^data\["([^"]+)"\]\s*=\s*\{/gm)) {
    const key = m[1];
    if (NOT_A_TIER.has(key)) continue;
    const { body } = braceBody(src, m.index + m[0].length - 1);
    if (!/\bContentType\s*=\s*RAID\d*_CONTENT/.test(body)) continue;
    raids.push({ key, name: RAID_NAMES[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2') });
  }
  return raids;
}

const normalise = (name: string) => name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');

/** The raid whose name matches the tier's, or null. Ignores case, punctuation and a leading "The". */
export function matchAtlasRaid(raids: AtlasRaid[], tierName: string): AtlasRaid | null {
  const wanted = normalise(tierName);
  return wanted ? raids.find((raid) => normalise(raid.name) === wanted) ?? null : null;
}

export type BossLoot = { name: string; isTrash: boolean; itemIds: number[] };
export type ParsedTable = { bosses: BossLoot[]; skipped: string[] };

/**
 * Strips Lua comments (`--[[ … ]]`, `--[==[ … ]==]` and `--` to end of line), leaving
 * string literals alone so a `--` inside a name survives.
 */
function stripComments(lua: string): string {
  let out = '';
  let i = 0;
  while (i < lua.length) {
    const c = lua[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < lua.length && lua[j] !== c && lua[j] !== '\n') j += lua[j] === '\\' ? 2 : 1;
      out += lua.slice(i, j + 1);
      i = j + 1;
    } else if (c === '-' && lua[i + 1] === '-') {
      const long = /^--\[(=*)\[/.exec(lua.slice(i, i + 64));
      if (long) {
        const close = lua.indexOf(`]${long[1]}]`, i + long[0].length);
        i = close === -1 ? lua.length : close + long[1].length + 2;
      } else {
        const nl = lua.indexOf('\n', i);
        i = nl === -1 ? lua.length : nl;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The text between the brace at `open` and its match, exclusive. Ignores braces in strings. */
function braceBody(src: string, open: number): { body: string; end: number } {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return { body: src.slice(open + 1, i), end: i };
  }
  throw new Error('Unbalanced braces in the AtlasLoot data.');
}

/** The top-level `{ … }` blocks and bare identifiers inside a table body, in order. */
function topLevelEntries(body: string): ({ kind: 'block'; text: string } | { kind: 'ref'; text: string })[] {
  const out: ({ kind: 'block'; text: string } | { kind: 'ref'; text: string })[] = [];
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === '{') {
      const { body: text, end } = braceBody(body, i);
      out.push({ kind: 'block', text });
      i = end + 1;
    } else if (c === '"' || c === "'") {
      // A stray string at the top level is not an entry; step over it.
      let j = i + 1;
      while (j < body.length && body[j] !== c) j += body[j] === '\\' ? 2 : 1;
      i = j + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][\w.]*/.exec(body.slice(i))!;
      out.push({ kind: 'ref', text: m[0] });
      i += m[0].length;
    } else i++;
  }
  return out;
}

function namedTable(src: string, pattern: RegExp): string | null {
  const m = pattern.exec(src);
  if (!m) return null;
  return braceBody(src, m.index + m[0].length - 1).body;
}

/** Parses one raid (`key`, e.g. "MoltenCore") out of AtlasLootClassic's data.lua. */
export function parseAtlasLoot(lua: string, key: string): ParsedTable {
  const src = stripComments(lua);
  const raid = namedTable(src, new RegExp(`data\\["${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]\\s*=\\s*\\{`));
  if (raid === null) throw new Error(`No data["${key}"] in the AtlasLoot file.`);
  const items = namedTable(raid, /\bitems\s*=\s*\{/);
  if (items === null) throw new Error(`data["${key}"] has no items table.`);

  const bosses: BossLoot[] = [];
  const skipped: string[] = [];
  for (const entry of topLevelEntries(items)) {
    if (entry.kind === 'ref') {
      skipped.push(`${entry.text} (a shared set, not boss loot)`);
      continue;
    }
    const raw = /\bname\s*=\s*(?:AL\[\s*)?"((?:[^"\\]|\\.)+)"/.exec(entry.text)?.[1];
    const name = raw?.replace(/\\(.)/g, '$1');
    if (!name) {
      skipped.push('an unnamed block');
      continue;
    }
    // NORMAL_DIFF when present, otherwise the first difficulty table.
    const diff = namedTable(entry.text, /\[NORMAL_DIFF\]\s*=\s*\{/) ?? namedTable(entry.text, /\[\w+_DIFF\]\s*=\s*\{/);
    const itemIds: number[] = [];
    for (const pair of (diff ?? '').matchAll(/\{\s*\d+\s*,\s*([^,}\s]+)/g)) {
      const id = /^\d+$/.test(pair[1]) ? Number(pair[1]) : NaN;
      if (Number.isSafeInteger(id) && id > 0) {
        if (!itemIds.includes(id)) itemIds.push(id);
      } else skipped.push(`${name}: ${pair[1]}`);
    }
    if (itemIds.length === 0) {
      skipped.push(`${name} (no item ids)`);
      continue;
    }
    bosses.push({ name, isTrash: /^trash/i.test(name), itemIds });
  }
  return { bosses, skipped };
}

/**
 * The plain format, for WoW Forever once its loot is public:
 * `{ "bosses": [{ "name": "Lucifron", "items": [16800, 16805] }, { "name": "Trash", "trash": true, "items": […] }] }`.
 */
export function parseIdsFile(json: unknown): ParsedTable {
  const bosses = (json && typeof json === 'object' ? (json as { bosses?: unknown }).bosses : undefined);
  if (!Array.isArray(bosses) || bosses.length === 0) throw new Error('it needs a non-empty "bosses" list.');
  const seen = new Set<string>();
  return {
    skipped: [],
    bosses: bosses.map((b, i) => {
      const { name, trash, items } = (b ?? {}) as { name?: unknown; trash?: unknown; items?: unknown };
      if (typeof name !== 'string' || !name.trim()) throw new Error(`boss ${i + 1} needs a name.`);
      if (seen.has(name.trim())) throw new Error(`"${name.trim()}" is listed twice.`);
      seen.add(name.trim());
      if (!Array.isArray(items) || !items.every((id) => Number.isSafeInteger(id) && id > 0)) throw new Error(`"${name}" needs "items": a list of item ids.`);
      return { name: name.trim(), isTrash: trash === true, itemIds: [...new Set(items as number[])] };
    }),
  };
}

/** Every item id in a table, once. */
export function allItemIds(table: ParsedTable): number[] {
  return [...new Set(table.bosses.flatMap((b) => b.itemIds))];
}

/* ---- foreverchanges.pro (WoW Forever dungeons) ---- */

export type ForeverDungeon = { slug: string; name: string };

const HTML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeHtml = (text: string) => text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (whole, hex, dec, named) => {
  if (named) return HTML_ENTITIES[named.toLowerCase()] ?? whole;
  const code = hex ? parseInt(hex, 16) : Number(dec);
  return Number.isSafeInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
});

/** The dungeons on foreverchanges.pro's index, each slug once (fragments such as `#quests` dropped), in page order. */
export function listForeverDungeons(html: string): ForeverDungeon[] {
  const found = new Map<string, { name: string; plain: boolean }>();
  for (const m of html.matchAll(/<a href="\/dungeons\/([a-z0-9-]+)(#[^"]*)?">([^<]+)<\/a>/g)) {
    const [, slug, fragment, text] = m;
    const name = decodeHtml(text).trim();
    const seen = found.get(slug);
    if (!name || (seen && (seen.plain || fragment))) continue;
    found.set(slug, { name, plain: !fragment });
  }
  return [...found].map(([slug, { name }]) => ({ slug, name }));
}

/** The text a Next.js page streams as `self.__next_f.push([1,"…"])` chunks, in order. */
function nextPayload(html: string): string {
  let text = '';
  for (const m of html.matchAll(/self\.__next_f\.push\((\[1,"[\s\S]*?"\])\)<\/script>/g)) {
    const chunk = JSON.parse(m[1]) as [number, string];
    text += chunk[1];
  }
  return text;
}

/** The JSON array that starts at `start`, or throws if it never closes or isn't JSON. */
function jsonArrayAt(text: string, start: number): unknown[] {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return JSON.parse(text.slice(start, i + 1)) as unknown[];
  }
  throw new Error('the embedded data is cut off.');
}

const FOREVER_KINDS = new Set(['boss', 'rare', 'object', 'trash']);
const UNCOMMON = 2;

/**
 * A foreverchanges.pro dungeon page as a loot table: bosses, rare monsters and objects in page order,
 * every `trash` entry on one "Trash" row (where the first one sits), uncommon (green) and better
 * items only, each id once. Strict: anything unrecognised throws, so a misread page never yields a
 * partial table. Rows left with no items are dropped; a dungeon with none at all throws.
 */
export function parseForeverDungeon(html: string): ParsedTable {
  let payload: string;
  let raw: unknown[] | null = null;
  try {
    payload = nextPayload(html);
    // The page repeats the boss data; every copy must agree.
    for (const m of payload.matchAll(/"bosses":\[/g)) {
      const copy = jsonArrayAt(payload, m.index + m[0].length - 1);
      if (raw && JSON.stringify(raw) !== JSON.stringify(copy)) throw new Error('the page’s copies of the boss data differ.');
      raw ??= copy;
    }
  } catch (error) {
    throw new Error(`the page’s data couldn’t be read (${(error as Error).message.replace(/\.$/, '')}).`);
  }
  if (!raw || raw.length === 0) throw new Error('the page has no boss data.');

  const rows: { name: string; trash: boolean; items: number[] }[] = [];
  let trashRow: (typeof rows)[number] | null = null;
  raw.forEach((entry, n) => {
    const { name, kind, items } = (entry ?? {}) as { name?: unknown; kind?: unknown; items?: unknown };
    if (typeof name !== 'string' || !name.trim()) throw new Error(`entry ${n + 1} has no name.`);
    if (typeof kind !== 'string' || !FOREVER_KINDS.has(kind)) throw new Error(`"${name}" is a kind of entry this site doesn’t know (${JSON.stringify(kind)}).`);
    if (!Array.isArray(items)) throw new Error(`"${name}" has no item list.`);
    const ids: number[] = [];
    for (const item of items) {
      const { i, q } = (item ?? {}) as { i?: unknown; q?: unknown };
      if (!Number.isSafeInteger(i) || (i as number) <= 0) throw new Error(`"${name}" has an item with no item id.`);
      if (!Number.isSafeInteger(q) || (q as number) < 0) throw new Error(`"${name}" has an item with no quality.`);
      if ((q as number) >= UNCOMMON) ids.push(i as number);
    }
    if (kind === 'trash') {
      if (!trashRow) { trashRow = { name: 'Trash', trash: true, items: [] }; rows.push(trashRow); }
      trashRow.items.push(...ids);
    } else rows.push({ name: name.trim(), trash: false, items: ids });
  });

  const kept = rows.filter((row) => row.items.length > 0);
  if (kept.length === 0) throw new Error('it has no green or better items.');
  return parseIdsFile({ bosses: kept.map((row) => ({ name: row.name, trash: row.trash, items: row.items })) });
}
