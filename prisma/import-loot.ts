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
 * --replace       drop the template's current table first; otherwise bosses are matched by
 *                 name and new items added.
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
    const template = await db.raidTemplate.findUnique({ where: { name: values.template }, select: { id: true, name: true } });
    if (!template) {
      const names = (await db.raidTemplate.findMany({ select: { name: true }, orderBy: { name: 'asc' } })).map((t) => t.name);
      throw new Error(`No template "${values.template}". Templates: ${names.join(', ')}.`);
    }

    const table = await readTable(values);
    for (const s of table.skipped) console.log(`skipped ${s}`);
    const ids = allItemIds(table);
    const cached = new Set((await db.lootItem.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((i) => i.id));
    const toFetch = values.refresh ? ids : ids.filter((id) => !cached.has(id));
    console.log(`${template.name} on the ${target} database: ${table.bosses.length} entries, ${ids.length} items, fetching ${toFetch.length} (about ${Math.ceil((toFetch.length * WOWHEAD_GAP_MS) / 1000)} s).`);

    const fetched = await refreshItems(db, toFetch.map((id) => ({ id, source })));
    for (const f of fetched.failed) console.log(`item ${f.id}: ${f.error}`);
    const have = new Set([...cached, ...fetched.saved]);

    await db.$transaction(async (tx) => {
      if (values.replace) await tx.lootBoss.deleteMany({ where: { templateId: template.id } });
      for (const [position, boss] of table.bosses.entries()) {
        const row = await tx.lootBoss.upsert({
          where: { templateId_name: { templateId: template.id, name: boss.name } },
          create: { templateId: template.id, name: boss.name, position, isTrash: boss.isTrash },
          update: { position, isTrash: boss.isTrash },
          select: { id: true },
        });
        const entries = boss.itemIds.filter((id) => have.has(id)).map((itemId, i) => ({ bossId: row.id, itemId, position: i }));
        await tx.lootTableEntry.createMany({ data: entries, skipDuplicates: true });
      }
    });

    const entries = await db.lootTableEntry.count({ where: { boss: { templateId: template.id } } });
    console.log(`Done: ${fetched.saved.length} items fetched, ${fetched.failed.length} failed, ${entries} table entries on ${template.name}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
