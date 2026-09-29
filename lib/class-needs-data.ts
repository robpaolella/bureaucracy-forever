import 'server-only';

import { unstable_cache } from 'next/cache';
import { CLASS_NEEDS, type ClassNeed, type NeedStatus } from '@/content/recruitment';
import { allSpecRows, groupNeeds, homeNeeds, type HomeNeed, type NeedRow } from '@/lib/class-needs';
import { db } from '@/lib/db';
import type { WowClass } from '@/lib/design/class-colors';

/** Cache tag for anything drawn from ClassNeed rows. PUT /api/class-needs expires it. */
export const CLASS_NEEDS_TAG = 'class-needs';

async function loadNeedRows(): Promise<NeedRow[]> {
  // `roles` is not read: the pages derive a spec's roles from SPECS. The column is kept
  // current on every write for the bot, which may read the table directly.
  const rows = await db.classNeed.findMany({ select: { class: true, spec: true, status: true, featured: true } });
  return rows.map((r) => ({ wowClass: r.class.toLowerCase() as WowClass, spec: r.spec, status: r.status.toLowerCase() as NeedStatus, featured: r.featured }));
}

/**
 * The stored rows, cached for a minute and expired on every officer write. When the
 * database is unreachable (a CI build has none) the public pages fall back to the
 * hand-written table rather than failing to render.
 */
export const getNeedRows = unstable_cache(loadNeedRows, ['class-needs-rows'], { revalidate: 60, tags: [CLASS_NEEDS_TAG] });

/**
 * The grouped table for the recruitment page, the home teaser and the bot. Every spec
 * appears, closed unless an officer said otherwise: "a closed spec means closed".
 */
export async function getClassNeeds(): Promise<ClassNeed[]> {
  try {
    return groupNeeds(allSpecRows(await getNeedRows()));
  } catch (error) {
    logFallback(error);
    return CLASS_NEEDS;
  }
}

/** The home page strip (see homeNeeds). Falls back to the hand-written table like the page. */
export async function getHomeNeeds(): Promise<HomeNeed[]> {
  try {
    return homeNeeds(allSpecRows(await getNeedRows()));
  } catch (error) {
    logFallback(error);
    return homeNeeds(CLASS_NEEDS.flatMap((n) => n.specs.map((spec) => ({ wowClass: n.wowClass, spec, status: n.status }))));
  }
}

// No database configured (a CI build) is expected; a configured database failing is not,
// and is logged as an error, but the public pages still render the hand-written table.
function logFallback(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  if (process.env.DATABASE_URL) console.error('class needs: database read failed, serving the hand-written table', detail);
  else console.warn('class needs: no database configured, serving the hand-written table');
}

/** Every class and spec with its status, for the editor. */
export async function getAllNeedRows(): Promise<NeedRow[]> {
  return allSpecRows(await getNeedRows());
}
