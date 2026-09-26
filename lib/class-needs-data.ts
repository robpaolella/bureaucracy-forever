import 'server-only';

import { unstable_cache } from 'next/cache';
import { CLASS_NEEDS, type ClassNeed, type NeedStatus } from '@/content/recruitment';
import { allSpecRows, groupNeeds, type NeedRow } from '@/lib/class-needs';
import { db } from '@/lib/db';
import type { WowClass } from '@/lib/design/class-colors';

/** Cache tag for anything drawn from ClassNeed rows. PUT /api/class-needs expires it. */
export const CLASS_NEEDS_TAG = 'class-needs';

async function loadNeedRows(): Promise<NeedRow[]> {
  // `roles` is not read: the pages derive a spec's roles from SPECS. The column is kept
  // current on every write for the bot, which may read the table directly.
  const rows = await db.classNeed.findMany({ select: { class: true, spec: true, status: true } });
  return rows.map((r) => ({ wowClass: r.class.toLowerCase() as WowClass, spec: r.spec, status: r.status.toLowerCase() as NeedStatus }));
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
    // No database configured (a CI build) is expected; a configured database failing is not,
    // and is logged as an error, but the public page still renders the hand-written table.
    const detail = error instanceof Error ? error.message : String(error);
    if (process.env.DATABASE_URL) console.error('class needs: database read failed, serving the hand-written table', detail);
    else console.warn('class needs: no database configured, serving the hand-written table');
    return CLASS_NEEDS;
  }
}

/** Every class and spec with its status, for the editor. */
export async function getAllNeedRows(): Promise<NeedRow[]> {
  return allSpecRows(await getNeedRows());
}
