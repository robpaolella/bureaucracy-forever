import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { parseNeedInput, rolesOfSpec } from '@/lib/class-needs';
import { CLASS_NEEDS_TAG, getClassNeeds } from '@/lib/class-needs-data';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** GET /api/class-needs — the grouped needs table, public (docs/06 § API routes; the bot's /recruiting reads it). */
export async function GET() {
  return NextResponse.json({ needs: await getClassNeeds() }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}

/**
 * PUT /api/class-needs — set one spec's status (officers). Body `{ wowClass, spec, status }`.
 * Upserts the row and expires the needs cache so the recruitment page, the home teaser
 * and the bot see it together. A spec that leaves high need loses its home-page star.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers edit class needs.' }, { status: 403, headers: NO_STORE });

  const parsed = parseNeedInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { wowClass, spec, status } = parsed.value;
  const cls = wowClass.toUpperCase() as Uppercase<typeof wowClass>;
  const st = status.toUpperCase() as Uppercase<typeof status>;
  const roles = rolesOfSpec(wowClass, spec).map((r) => r.toUpperCase() as Uppercase<typeof r>);

  await db.classNeed.upsert({
    where: { class_spec: { class: cls, spec } },
    create: { class: cls, spec, roles, status: st },
    update: { status: st, roles, ...(st !== 'HIGH' && { featured: false }) },
  });
  revalidateTag(CLASS_NEEDS_TAG, 'max');
  return NextResponse.json({ wowClass, spec, status }, { headers: NO_STORE });
}
