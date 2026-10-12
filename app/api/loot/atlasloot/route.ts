import { NextResponse } from 'next/server';
import { atlasLootSettings } from '@/lib/config';
import { itemSourceError } from '@/lib/item-sources';
import { listAtlasRaids, parseAtlasLoot } from '@/lib/loot-import';
import { toIdsFile } from '@/lib/loot-load-client';
import { requireLootOfficer } from '../../_loot';
import { jsonBody, NO_STORE } from '../../_officer';

export const maxDuration = 60;

const DOWNLOAD_FAILED = 'Couldn’t download AtlasLoot’s data. Try again, or load a file.';
const UNREADABLE = 'Couldn’t read AtlasLoot’s data. Try again later, or load a file.';

/** AtlasLoot's data.lua at the configured address; the same file serves the list and a raid. */
async function atlasLua(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** The raids in the data, or null when it isn't AtlasLoot's format. */
function raidsIn(lua: string) {
  try {
    return listAtlasRaids(lua);
  } catch {
    return null;
  }
}

/**
 * GET: { source, off, raids }. `off` is true when production would refuse the configured item
 * database (the window greys AtlasLoot), and then no data is fetched.
 * POST { raidKey }: the raid's table in the file format plus the `source` to preview it with.
 * Officers never send a URL or a version; both come from server settings.
 */
export async function GET() {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const { dataUrl, itemSource } = atlasLootSettings();
  if (itemSourceError(itemSource)) return NextResponse.json({ source: itemSource, off: true, raids: [] }, { headers: NO_STORE });
  const lua = await atlasLua(dataUrl);
  if (lua === null) return NextResponse.json({ error: DOWNLOAD_FAILED }, { status: 502, headers: NO_STORE });
  const raids = raidsIn(lua);
  if (!raids) return NextResponse.json({ error: UNREADABLE }, { status: 502, headers: NO_STORE });
  return NextResponse.json({ source: itemSource, off: false, raids }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const { dataUrl, itemSource } = atlasLootSettings();
  const policyError = itemSourceError(itemSource);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400, headers: NO_STORE });
  const body = (await jsonBody(request) ?? {}) as { raidKey?: unknown };
  if (typeof body.raidKey !== 'string' || !body.raidKey) return NextResponse.json({ error: 'Choose a raid.' }, { status: 400, headers: NO_STORE });
  const lua = await atlasLua(dataUrl);
  if (lua === null) return NextResponse.json({ error: DOWNLOAD_FAILED }, { status: 502, headers: NO_STORE });
  const raids = raidsIn(lua);
  if (!raids) return NextResponse.json({ error: UNREADABLE }, { status: 502, headers: NO_STORE });
  const raid = raids.find((r) => r.key === body.raidKey);
  if (!raid) return NextResponse.json({ error: 'AtlasLoot’s data on this site has no such raid. Choose another raid or load a file.' }, { status: 404, headers: NO_STORE });
  try {
    const table = parseAtlasLoot(lua, raid.key);
    return NextResponse.json({ source: itemSource, name: `AtlasLoot: ${raid.name}`, file: toIdsFile(table) }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json({ error: `AtlasLoot’s data for ${raid.name} couldn’t be read: ${(error as Error).message}` }, { status: 422, headers: NO_STORE });
  }
}
