import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseSeriesInput } from '@/lib/raid-series-rules';
import { generateInstances, rosterUserIds } from '@/lib/tick';
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
 * POST /api/raid-series — a new weekly slot in guild time (SYNC-SPEC §3, §9.3). Its instances
 * are generated at once so the calendar shows them; posting stays with the bot's tick, which
 * runs within the minute.
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
  const generated = await generateInstances(new Date(), await rosterUserIds(), series.id);
  return NextResponse.json({ id: series.id, generated }, { status: 201, headers: NO_STORE });
}
