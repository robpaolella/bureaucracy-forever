import { after, NextResponse } from 'next/server';
import { raidSummary } from '@/lib/bot-events';
import { notifyBot } from '@/lib/bot-notify';
import { db } from '@/lib/db';
import { parseRaidInput, parseRequirements } from '@/lib/raids';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * PATCH /api/raids/[id] — edit or cancel a raid (officers; docs/04 § Raid detail officer
 * actions). Body is either `{ cancelled: boolean }` or the schedule form's fields. A raid
 * that has finished is history and cannot change.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers manage raids.' }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  const raid = await db.raid.findUnique({ where: { id }, select: { id: true, startsAt: true, durationMin: true, cancelledAt: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.startsAt.getTime() + raid.durationMin * 60_000 < Date.now()) {
    return NextResponse.json({ error: 'This raid has already happened.' }, { status: 409, headers: NO_STORE });
  }

  const body: unknown = await request.json().catch(() => null);
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const FULL = { id: true, name: true, startsAt: true, durationMin: true, notes: true, cancelledAt: true, requirements: true, discordEventId: true } as const;
  if (typeof b.cancelled === 'boolean') {
    const updated = await db.raid.update({ where: { id: raid.id }, data: { cancelledAt: b.cancelled ? new Date() : null }, select: FULL });
    after(() => notifyBot({ type: b.cancelled ? 'raid.cancelled' : 'raid.restored', raid: raidSummary({ ...updated, requirements: parseRequirements(updated.requirements) }) }));
    return NextResponse.json({ id: updated.id, cancelled: updated.cancelledAt !== null }, { headers: NO_STORE });
  }

  // Restore first, then edit: the page disables Edit on a cancelled raid, and the route agrees.
  if (raid.cancelledAt) return NextResponse.json({ error: 'Restore the raid before editing it.' }, { status: 409, headers: NO_STORE });
  const parsed = parseRaidInput(b);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  if (parsed.startsAt.getTime() + parsed.value.durationMin * 60_000 < Date.now()) {
    return NextResponse.json({ error: 'That start is already in the past.' }, { status: 400, headers: NO_STORE });
  }
  const { value } = parsed;
  const updated = await db.raid.update({
    where: { id: raid.id },
    data: { name: value.name, startsAt: parsed.startsAt, durationMin: value.durationMin, requirements: value.requirements, notes: value.notes || null },
    select: FULL,
  });
  after(() => notifyBot({ type: 'raid.updated', raid: raidSummary({ ...updated, requirements: value.requirements }) }));
  return NextResponse.json({ id: updated.id, name: updated.name, startsAt: updated.startsAt.toISOString() }, { headers: NO_STORE });
}
