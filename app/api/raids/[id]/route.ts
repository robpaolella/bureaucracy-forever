import { after, NextResponse } from 'next/server';
import { enqueue } from '@/lib/outbox';
import { db } from '@/lib/db';
import { locksAtFor, parseRaidInput } from '@/lib/raids';
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
  const raid = await db.raid.findUnique({ where: { id }, select: { id: true, startsAt: true, durationMin: true, cancelledAt: true, discordThreadId: true, locksAt: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.startsAt.getTime() + raid.durationMin * 60_000 < Date.now()) {
    return NextResponse.json({ error: 'This raid has already happened.' }, { status: 409, headers: NO_STORE });
  }

  const body: unknown = await request.json().catch(() => null);
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  if (typeof b.cancelled === 'boolean') {
    // Already in the requested state: answer without queuing a duplicate job.
    if (b.cancelled === (raid.cancelledAt !== null)) return NextResponse.json({ id: raid.id, cancelled: b.cancelled }, { headers: NO_STORE });
    const now = new Date();
    // Restoring lands on SCHEDULED, or LOCKED if the lock time has already passed.
    const status = b.cancelled ? 'CANCELLED' : raid.locksAt.getTime() <= now.getTime() ? 'LOCKED' : 'SCHEDULED';
    const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 500) : '';
    const updated = await db.raid.update({ where: { id: raid.id }, data: { cancelledAt: b.cancelled ? now : null, status, lockedAt: status === 'LOCKED' ? now : null }, select: { id: true, cancelledAt: true, discordThreadId: true } });
    // Only a raid the bot has posted needs the thread told (SYNC-SPEC §5).
    if (updated.discordThreadId) after(() => enqueue(b.cancelled ? 'raid.cancel' : 'raid.update', { raidId: raid.id, reason }));
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
  // Moving the start moves the lock with it; an edited instance leaves its series' edits (SYNC-SPEC §3 detached).
  const updated = await db.raid.update({
    where: { id: raid.id },
    data: { name: value.name, startsAt: parsed.startsAt, locksAt: locksAtFor(parsed.startsAt, Math.round((raid.startsAt.getTime() - raid.locksAt.getTime()) / 60_000)), durationMin: value.durationMin, requirements: value.requirements, notes: value.notes || null, detached: true },
    select: { id: true, name: true, startsAt: true, discordThreadId: true },
  });
  if (updated.discordThreadId) after(() => enqueue('raid.update', { raidId: raid.id }));
  return NextResponse.json({ id: updated.id, name: updated.name, startsAt: updated.startsAt.toISOString() }, { headers: NO_STORE });
}
