import { NextResponse } from 'next/server';
import { fetchForeverPage, isForeverSlug } from '@/lib/foreverchanges';
import { listForeverDungeons, parseForeverDungeon } from '@/lib/loot-import';
import { toIdsFile } from '@/lib/loot-load-client';
import { requireLootOfficer } from '../../_loot';
import { jsonBody, NO_STORE } from '../../_officer';

export const maxDuration = 60;

const FALLBACK = 'Try again later, or load a file manually.';
const UNREACHABLE = `Couldn’t reach foreverchanges.pro, or it was too slow. ${FALLBACK}`;
const TOO_LARGE = `foreverchanges.pro sent more than this site will read. ${FALLBACK}`;
const UNKNOWN_SHAPE = `foreverchanges.pro’s page isn’t in a shape this site knows. ${FALLBACK}`;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });
const pageFailure = (reason: 'unreachable' | 'too-large') => fail(reason === 'too-large' ? TOO_LARGE : UNREACHABLE, 502);

/** GET: { dungeons: [{ slug, name }] } from foreverchanges.pro's index. */
export async function GET() {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const page = await fetchForeverPage('/dungeons');
  if (!page.ok) return pageFailure(page.reason);
  const dungeons = listForeverDungeons(page.html);
  if (dungeons.length === 0) return fail(UNKNOWN_SHAPE, 502);
  return NextResponse.json({ dungeons }, { headers: NO_STORE });
}

/**
 * POST { slug }: the dungeon's table in the file format, to preview with the WoW Forever item
 * database. The slug must be on the index; officers never send a URL. Nothing is saved.
 */
export async function POST(request: Request) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const body = (await jsonBody(request) ?? {}) as { slug?: unknown };
  if (!isForeverSlug(body.slug)) return fail('Choose a dungeon.', 400);
  const index = await fetchForeverPage('/dungeons');
  if (!index.ok) return pageFailure(index.reason);
  const dungeon = listForeverDungeons(index.html).find((d) => d.slug === body.slug);
  if (!dungeon) return fail(`foreverchanges.pro has no dungeon like that. Choose another dungeon, or load a file manually.`, 404);
  const page = await fetchForeverPage(`/dungeons/${dungeon.slug}`);
  if (!page.ok) return pageFailure(page.reason);
  try {
    const table = parseForeverDungeon(page.html);
    return NextResponse.json({ source: 'FOREVER', name: `WoW Forever: ${dungeon.name}`, file: toIdsFile(table) }, { headers: NO_STORE });
  } catch (error) {
    return fail(`${dungeon.name} on foreverchanges.pro couldn’t be read: ${(error as Error).message} ${FALLBACK}`, 422);
  }
}
