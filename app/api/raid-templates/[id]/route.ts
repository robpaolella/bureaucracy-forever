import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { parseTemplateInput } from '@/lib/raid-series-rules';
import { getSession } from '@/lib/session';
import { TEMPLATES } from '@/content/planner';
import { jsonBody, NO_STORE, requireOfficer } from '../../_officer';

/** PATCH /api/raid-templates/:id — edit a template (officers). Existing raids keep their copy of the requirements. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const parsed = parseTemplateInput(await jsonBody(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { id } = await params;
  try {
    const updated = await db.raidTemplate.update({ where: { id }, data: { ...parsed.value, requirements: parsed.value.requirements as unknown as Prisma.InputJsonValue }, select: { id: true, name: true } });
    return NextResponse.json(updated, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return NextResponse.json({ error: 'No such template.' }, { status: 404, headers: NO_STORE });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return NextResponse.json({ error: 'A template with that name exists.' }, { status: 409, headers: NO_STORE });
    throw e;
  }
}

/**
 * DELETE /api/raid-templates/:id — Guild Master or Administrator only (lib/auth/roles.ts),
 * not every officer. Refused while any series, active or not, still uses the template.
 * Raids made from it keep their own copy of everything and lose only the link.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (!session.templateAdmin) return NextResponse.json({ error: 'Only the Guild Master or an Administrator can delete templates.' }, { status: 403, headers: NO_STORE });
  const { id } = await params;
  const inUse = await db.raidSeries.count({ where: { templateId: id } });
  if (inUse > 0) return NextResponse.json({ error: TEMPLATES.inUse(inUse) }, { status: 409, headers: NO_STORE });
  try {
    const deleted = await db.raidTemplate.delete({ where: { id }, select: { id: true, name: true } });
    return NextResponse.json(deleted, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return NextResponse.json({ error: 'No such template.' }, { status: 404, headers: NO_STORE });
    // A series was added between the count and the delete.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') return NextResponse.json({ error: TEMPLATES.inUse(1) }, { status: 409, headers: NO_STORE });
    throw e;
  }
}
