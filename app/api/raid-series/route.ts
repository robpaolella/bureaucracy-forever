import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseSeriesInput } from '@/lib/raid-series-rules';
import { runTick } from '@/lib/tick';
import { ensureUser } from '@/lib/users';
import { jsonBody, NO_STORE, requireOfficer } from '../_officer';

/** GET /api/raid-series — every series with its template (officers). */
export async function GET() {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const rows = await db.raidSeries.findMany({ include: { template: { select: { name: true, short: true } }, _count: { select: { raids: true } } }, orderBy: [{ active: 'desc' }, { weekday: 'asc' }, { startTime: 'asc' }] });
  return NextResponse.json({ series: rows }, { headers: NO_STORE });
}

/**
 * POST /api/raid-series — a new weekly slot in guild time (SYNC-SPEC §3, §9.3). Runs tick at
 * once so the officer sees the instances and, if inside the post window, the first Discord post.
 */
export async function POST(request: Request) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const parsed = parseSeriesInput(await jsonBody(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const template = await db.raidTemplate.findUnique({ where: { id: parsed.value.templateId }, select: { id: true, active: true } });
  if (!template || !template.active) return NextResponse.json({ error: 'Pick an active template.' }, { status: 400, headers: NO_STORE });
  const officer = await ensureUser(auth.session);
  const series = await db.raidSeries.create({ data: { ...parsed.value, createdById: officer.id }, select: { id: true } });
  const counts = await runTick();
  return NextResponse.json({ id: series.id, generated: counts.generated, posted: counts.posted }, { status: 201, headers: NO_STORE });
}
