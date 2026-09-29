import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { parseRequirements } from '@/lib/raids';
import { parseTemplateInput } from '@/lib/raid-series-rules';
import { jsonBody, NO_STORE, requireOfficer } from '../_officer';

/** GET /api/raid-templates — every template, active first (officers). */
export async function GET() {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const rows = await db.raidTemplate.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  return NextResponse.json({ templates: rows.map((t) => ({ ...t, requirements: parseRequirements(t.requirements) })) }, { headers: NO_STORE });
}

/** POST /api/raid-templates — a new template (officers). 409 when the name is taken. */
export async function POST(request: Request) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const parsed = parseTemplateInput(await jsonBody(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  try {
    const created = await db.raidTemplate.create({ data: { ...parsed.value, requirements: parsed.value.requirements as unknown as Prisma.InputJsonValue }, select: { id: true, name: true } });
    return NextResponse.json(created, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return NextResponse.json({ error: 'A template with that name exists.' }, { status: 409, headers: NO_STORE });
    throw e;
  }
}
