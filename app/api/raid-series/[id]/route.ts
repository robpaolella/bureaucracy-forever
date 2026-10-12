import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { lockReserveTier } from '@/lib/loot-blocks';
import { enqueue } from '@/lib/outbox';
import { parseSeriesInput } from '@/lib/raid-series-rules';
import { locksAtFor, parseRequirements } from '@/lib/raids';
import { instanceName, occurrenceInWeekOf } from '@/lib/series';
import { generateInstances, rosterUserIds } from '@/lib/tick';
import { jsonBody, NO_STORE, requireOfficer } from '../../_officer';

/** The new tier plus each distinct old tier of the raids, sorted by id; none when no raid changes tier. */
function tiersToLock(raids: { templateId: string | null }[], newTier: string): string[] {
  if (!raids.some((raid) => raid.templateId !== newTier)) return [];
  const tiers = new Set([newTier, ...raids.flatMap((raid) => (raid.templateId ? [raid.templateId] : []))]);
  return [...tiers].sort();
}

/**
 * PATCH /api/raid-series/:id — "this and future raids" (SYNC-SPEC §9.3). The series changes,
 * and every future instance that was not edited on its own moves with it, in place: same
 * guild week, the new weekday and time, the new length, notes and template. Sign-ups stay,
 * links stay, and a posted instance gets a `raid.update` so its Discord post follows. New
 * dates the rule now covers are generated at once. `{ active: false }` deactivates: future
 * unposted instances are removed (the modal says so); posted ones stay to be cancelled one
 * by one.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const { id } = await params;
  const existing = await db.raidSeries.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'No such series.' }, { status: 404, headers: NO_STORE });
  const body = (await jsonBody(request)) as Record<string, unknown> | null;
  const merged = { ...existing, notes: existing.notes ?? '', ...(body ?? {}) };
  const parsed = parseSeriesInput(merged);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { value } = parsed;
  const template = await db.raidTemplate.findUnique({ where: { id: value.templateId }, select: { id: true, name: true, requirements: true, active: true } });
  if (!template || !template.active) return NextResponse.json({ error: 'Pick an active template.' }, { status: 400, headers: NO_STORE });

  const now = new Date();
  await db.raidSeries.update({ where: { id }, data: value });

  if (!value.active) {
    const gone = await db.raid.deleteMany({ where: { seriesId: id, status: 'SCHEDULED', startsAt: { gt: now }, postedAt: null, detached: false, lootAwards: { none: {} } } });
    return NextResponse.json({ id, moved: 0, dropped: gone.count, generated: 0 }, { headers: NO_STORE });
  }

  // Move the instances the rule still owns. One that would land in the past, or on an
  // instant another instance already holds, is left where it is.
  const ownedWhere = { seriesId: id, status: 'SCHEDULED', startsAt: { gt: now }, detached: false } as const;
  const ownedSelect = { id: true, startsAt: true, discordThreadId: true, templateId: true } as const;
  const requirements = parseRequirements(template.requirements) as unknown as Prisma.InputJsonValue;
  const moveData = (startsAt: Date) => ({
    name: instanceName(template.name, startsAt),
    startsAt,
    locksAt: locksAtFor(startsAt, value.lockMinutesBefore),
    durationMin: value.durationMin,
    notes: value.notes || null,
    requirements,
    templateId: template.id,
  });
  const preview = await db.raid.findMany({ where: ownedWhere, select: ownedSelect });
  let moved = 0;
  if (!preview.some((raid) => raid.templateId !== template.id)) {
    for (const raid of preview) {
      const startsAt = occurrenceInWeekOf(raid.startsAt, value);
      if (startsAt.getTime() <= now.getTime()) continue;
      try {
        await db.raid.update({ where: { id: raid.id }, data: moveData(startsAt) });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') continue;
        throw error;
      }
      moved += 1;
      if (raid.discordThreadId) await enqueue('raid.update', { raidId: raid.id });
    }
  } else {
    // The tier changes, so the moves take the lock of every tier involved (#236), in id order
    // so two opposite edits cannot deadlock. The raids are read again once the locks are held;
    // if a concurrent change added a tier we do not hold, release and lock again.
    let held = tiersToLock(preview, template.id);
    for (;;) {
      const outcome = await db.$transaction(async (tx) => {
        for (const tier of held) await lockReserveTier(tx, tier);
        const owned = await tx.raid.findMany({ where: ownedWhere, select: ownedSelect });
        const needed = tiersToLock(owned, template.id);
        if (needed.some((tier) => !held.includes(tier))) return { retry: needed, count: null };
        let count = 0;
        for (const raid of owned) {
          const startsAt = occurrenceInWeekOf(raid.startsAt, value);
          if (startsAt.getTime() <= now.getTime()) continue;
          // A unique violation aborts the whole transaction, so a collision rolls back to a savepoint.
          await tx.$executeRaw`SAVEPOINT series_move`;
          try {
            await tx.raid.update({ where: { id: raid.id }, data: moveData(startsAt) });
          } catch (error) {
            if ((error as { code?: string }).code !== 'P2002') throw error;
            await tx.$executeRaw`ROLLBACK TO SAVEPOINT series_move`;
            continue;
          }
          await tx.$executeRaw`RELEASE SAVEPOINT series_move`;
          count += 1;
          if (raid.discordThreadId) await enqueue('raid.update', { raidId: raid.id }, tx);
        }
        return { retry: null, count };
      }, { isolationLevel: 'ReadCommitted' });
      if (outcome.retry === null) { moved = outcome.count; break; }
      held = outcome.retry;
    }
  }
  const generated = await generateInstances(now, await rosterUserIds(), id);
  return NextResponse.json({ id, moved, dropped: 0, generated }, { headers: NO_STORE });
}

/**
 * DELETE /api/raid-series/:id — remove a series for good (officers). Like deactivating, its
 * future unposted instances go; posted and past raids stay on the calendar as one-off raids
 * (their seriesId is cleared by the relation). Frees its template to be deleted.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const { id } = await params;
  const now = new Date();
  try {
    const dropped = await db.$transaction(async (tx) => {
      const gone = await tx.raid.deleteMany({ where: { seriesId: id, status: 'SCHEDULED', startsAt: { gt: now }, postedAt: null, detached: false, lootAwards: { none: {} } } });
      await tx.raidSeries.delete({ where: { id } });
      return gone.count;
    });
    return NextResponse.json({ id, dropped }, { headers: NO_STORE });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') return NextResponse.json({ error: 'No such series.' }, { status: 404, headers: NO_STORE });
    throw error;
  }
}
