import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { parseFeatureInput } from '@/lib/class-needs';
import { CLASS_NEEDS_TAG } from '@/lib/class-needs-data';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * PUT /api/class-needs/featured — star or unstar one spec for the home page (officers).
 * Body `{ wowClass, spec, featured }`. One star at a time: starring a spec clears the
 * last one. Only a high-need spec can be starred.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers edit class needs.' }, { status: 403, headers: NO_STORE });

  const parsed = parseFeatureInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { wowClass, spec, featured } = parsed.value;
  const key = { class_spec: { class: wowClass.toUpperCase() as Uppercase<typeof wowClass>, spec } };

  if (featured) {
    const starred = await db.$transaction(async (tx) => {
      const row = await tx.classNeed.findUnique({ where: key, select: { status: true } });
      if (row?.status !== 'HIGH') return false;
      await tx.classNeed.updateMany({ where: { featured: true }, data: { featured: false } });
      await tx.classNeed.update({ where: key, data: { featured: true } });
      return true;
    });
    if (!starred) return NextResponse.json({ error: 'Only a high-need spec can be featured.' }, { status: 409, headers: NO_STORE });
  } else {
    await db.classNeed.updateMany({ where: key.class_spec, data: { featured: false } });
  }
  revalidateTag(CLASS_NEEDS_TAG, 'max');
  return NextResponse.json({ wowClass, spec, featured }, { headers: NO_STORE });
}
