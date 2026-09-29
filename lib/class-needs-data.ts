import 'server-only';

import { revalidateTag, unstable_cache } from 'next/cache';
import { CLASS_NEEDS, type ClassNeed, type NeedStatus } from '@/content/recruitment';
import { allSpecRows, groupNeeds, rolesOfSpec, type NeedRow } from '@/lib/class-needs';
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

/**
 * The stored rows straight from the database, skipping the cache. For the bot's
 * /recruitment: `revalidateTag(…, 'max')` marks the cache stale rather than emptying it,
 * so the first cached read after a write would still show the old status.
 */
export async function readNeedRowsUncached(): Promise<NeedRow[]> {
  return loadNeedRows();
}

/** Every class and spec with its status, for the editor. */
export async function getAllNeedRows(): Promise<NeedRow[]> {
  return allSpecRows(await getNeedRows());
}

/**
 * Set one spec's status: upsert the row (with the spec's roles, kept current for the bot)
 * and expire the needs cache so the recruitment page, the home teaser and the editor
 * follow. The row must already be validated by parseNeedInput.
 */
export async function setClassNeed({ wowClass, spec, status }: NeedRow): Promise<void> {
  const cls = wowClass.toUpperCase() as Uppercase<typeof wowClass>;
  const st = status.toUpperCase() as Uppercase<typeof status>;
  const roles = rolesOfSpec(wowClass, spec).map((r) => r.toUpperCase() as Uppercase<typeof r>);
  await db.classNeed.upsert({
    where: { class_spec: { class: cls, spec } },
    create: { class: cls, spec, roles, status: st },
    update: { status: st, roles },
  });
  revalidateTag(CLASS_NEEDS_TAG, 'max');
}
