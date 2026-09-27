import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { parseTemplateInput } from '@/lib/raid-series-rules';
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
