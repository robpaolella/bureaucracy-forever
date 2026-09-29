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
  const raid = namedTable(src, new RegExp(`data\\["${key.replace(/[^\w]/g, '')}"\\]\\s*=\\s*\\{`));
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
  if (!Array.isArray(bosses) || bosses.length === 0) throw new Error('The ids file needs a non-empty "bosses" list.');
  const seen = new Set<string>();
  return {
    skipped: [],
    bosses: bosses.map((b, i) => {
      const { name, trash, items } = (b ?? {}) as { name?: unknown; trash?: unknown; items?: unknown };
      if (typeof name !== 'string' || !name.trim()) throw new Error(`Boss ${i + 1} has no name.`);
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
