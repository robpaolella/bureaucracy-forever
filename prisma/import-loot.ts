/**
 * Loads a raid tier's loot table and fetches its items from Wowhead.
 *
 *   npm run db:staging:loot -- --template "Molten Core" --atlas MoltenCore --source classic
 *   npm run loot:import -- --template "Molten Core" --ids forever-mc.json --source forever --replace
 *
 * --atlas <key>   a raid from AtlasLootClassic's data.lua at the pinned commit (lib/loot-import.ts);
 *                 --atlas-file <path> reads a local copy instead of downloading it.
 * --ids <file>    the plain JSON format: { "bosses": [{ "name", "trash"?, "items": [ids] }] }.
 * --source        classic | forever: the Wowhead database items are fetched from (default classic).
 * --replace       make the table exactly the source: bosses and items it lacks are removed.
 *                 Without it, bosses are matched by name, their items set in the source's
 *                 order, and anything extra (entered on /officers/loot) kept after them.
 * --refresh       fetch items already in the cache again.
 *
 * Writes only to a local or staging database (./write-guard.ts). Production loot is entered
 * on /officers/loot. Items Wowhead cannot find are reported and left out of the table.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { allItemIds, ATLASLOOT_DATA_URL, parseAtlasLoot, parseIdsFile, type ParsedTable } from '@/lib/loot-import';
import { refreshItems } from '@/lib/loot-items';
import { WOWHEAD_GAP_MS } from '@/lib/wowhead';
import { assertWriteTarget } from './write-guard';

loadEnv({ path: '.env.local' });
loadEnv();

async function readTable(values: { atlas?: string; 'atlas-file'?: string; ids?: string }): Promise<ParsedTable> {
  if (values.ids) return parseIdsFile(JSON.parse(readFileSync(values.ids, 'utf8')));
  if (!values.atlas) throw new Error('Pass --atlas <key> or --ids <file>.');
  let lua: string;
  if (values['atlas-file']) lua = readFileSync(values['atlas-file'], 'utf8');
  else {
    const res = await fetch(ATLASLOOT_DATA_URL);
    if (!res.ok) throw new Error(`Could not download AtlasLoot data (${res.status}).`);
    lua = await res.text();
  }
  return parseAtlasLoot(lua, values.atlas);
}

async function main() {
  const { values } = parseArgs({
    options: {
      template: { type: 'string' },
      atlas: { type: 'string' },
      'atlas-file': { type: 'string' },
      ids: { type: 'string' },
      source: { type: 'string', default: 'classic' },
      replace: { type: 'boolean', default: false },
      refresh: { type: 'boolean', default: false },
    },
  });
  if (!values.template) throw new Error('Pass --template "<raid template name>".');
  const source = values.source === 'forever' ? 'FOREVER' : values.source === 'classic' ? 'CLASSIC' : null;
  if (!source) throw new Error('--source is classic or forever.');

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const target = assertWriteTarget(connectionString);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });
  try {
    const table = await readTable(values);
    for (const s of table.skipped) console.log(`skipped ${s}`);

    const template = await db.raidTemplate.findUnique({ where: { name: values.template }, select: { id: true, name: true } });
    if (!template) {
      const names = (await db.raidTemplate.findMany({ select: { name: true }, orderBy: { name: 'asc' } })).map((t) => t.name);
      throw new Error(`No template "${values.template}". Templates: ${names.join(', ')}.`);
    }

    const ids = allItemIds(table);
    // Classic and Forever can use one id for different items, so a cached row from the other
    // database counts as missing.
    const cached = new Set((await db.lootItem.findMany({ where: { id: { in: ids }, source }, select: { id: true } })).map((i) => i.id));
    const toFetch = values.refresh ? ids : ids.filter((id) => !cached.has(id));
    console.log(`${template.name} on the ${target} database: ${table.bosses.length} entries, ${ids.length} items, fetching ${toFetch.length} (about ${Math.ceil((toFetch.length * WOWHEAD_GAP_MS) / 1000)} s).`);

    const fetched = await refreshItems(db, toFetch.map((id) => ({ id, source })));
    for (const f of fetched.failed) console.log(`item ${f.id}: ${f.error}`);
    const have = new Set([...cached, ...fetched.saved]);

    await db.$transaction(
      async (tx) => {
        if (values.replace) {
          // Awards keep the boss name when their boss row goes (onDelete SetNull), but say so.
          const gone = await tx.lootBoss.findMany({ where: { templateId: template.id, name: { notIn: table.bosses.map((b) => b.name) } }, select: { id: true, name: true, _count: { select: { awards: true } } } });
          for (const g of gone) console.log(`removing ${g.name}${g._count.awards ? ` (${g._count.awards} awards keep its name, lose the link)` : ''}`);
          await tx.lootBoss.deleteMany({ where: { id: { in: gone.map((g) => g.id) } } });
        }
        for (const [position, boss] of table.bosses.entries()) {
          const row = await tx.lootBoss.upsert({
            where: { templateId_name: { templateId: template.id, name: boss.name } },
            create: { templateId: template.id, name: boss.name, position, isTrash: boss.isTrash },
            update: { position, isTrash: boss.isTrash },
            select: { id: true },
          });
          // The source's items in its order; without --replace, items already on the boss
          // that the source lacks (added on /officers/loot) stay, after them.
          const itemIds = boss.itemIds.filter((id) => have.has(id));
          const extra = values.replace
            ? []
            : (await tx.lootTableEntry.findMany({ where: { bossId: row.id, itemId: { notIn: itemIds } }, select: { itemId: true }, orderBy: { position: 'asc' } })).map((e) => e.itemId);
          await tx.lootTableEntry.deleteMany({ where: { bossId: row.id } });
          await tx.lootTableEntry.createMany({ data: [...itemIds, ...extra].map((itemId, i) => ({ bossId: row.id, itemId, position: i })) });
        }
      },
      { timeout: 60_000 },
    );

    const entries = await db.lootTableEntry.count({ where: { boss: { templateId: template.id } } });
    console.log(`Done: ${fetched.saved.length} items fetched, ${fetched.failed.length} failed, ${entries} table entries on ${template.name}.`);
    if (fetched.failed.length > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
