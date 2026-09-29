import 'server-only';

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { enqueue } from '@/lib/outbox';
import { locksAtFor, parseRequirements } from '@/lib/raids';
import { instanceName, isRosterRank, missingOccurrences, occurrences } from '@/lib/series';
import { trialCheckInDue } from '@/lib/rank-rules';
import { dueForClose, dueForLock, dueForNudge, dueForPost, HOUR_MS, reminderDue } from '@/lib/tick-rules';

const RECONCILE_MARKER = 'tick:reconcile';
/** DONE and FAILED jobs and idempotency keys older than this are trimmed by the hourly reconcile. */
const RETENTION_DAYS = 14;

export type TickCounts = {
  generated: number;
  rosterAdded: number;
  rosterRemoved: number;
  posted: number;
  reminded: number;
  locked: number;
  closed: number;
  nudged: number;
  trialsRaised: number;
  reconciled: number;
};

/** Users on the roster (SYNC-SPEC §3): in the guild with rank RAIDER, TRIAL or OFFICER. Rank alone decides; a main is not required. */
export async function rosterUserIds(): Promise<string[]> {
  const users = await db.user.findMany({ where: { inGuild: true }, select: { id: true, rank: true } });
  return users.filter((u) => isRosterRank(u.rank)).map((u) => u.id);
}

/**
 * §6 step 1: create the missing instances of every active series (or of one series) with
 * the roster on each. Dates that already have a raid for the series are skipped, so a moved
 * instance is not regenerated beside itself. The (seriesId, startsAt) unique index makes a
 * concurrent run (an officer saving a series while the bot's tick runs) lose quietly.
 */
export async function generateInstances(now: Date, roster: string[], seriesId?: string): Promise<number> {
  let generated = 0;
  const seriesList = await db.raidSeries.findMany({ where: { id: seriesId, active: true, template: { active: true } }, include: { template: true, raids: { select: { startsAt: true } } } });
  for (const s of seriesList) {
    const wanted = occurrences({ weekday: s.weekday, startTime: s.startTime, horizonWeeks: s.horizonWeeks }, now);
    for (const startsAt of missingOccurrences(wanted, s.raids.map((r) => r.startsAt), s.skippedDates)) {
      try {
        await db.raid.create({
          data: {
            name: instanceName(s.template.name, startsAt),
            startsAt,
            locksAt: locksAtFor(startsAt, s.lockMinutesBefore),
            durationMin: s.durationMin,
            notes: s.notes,
            requirements: parseRequirements(s.template.requirements) as unknown as Prisma.InputJsonValue,
            templateId: s.templateId,
            seriesId: s.id,
            signups: { create: roster.map((userId) => ({ userId, standing: 'ROSTER' as const, source: 'WEB' as const })) },
          },
        });
        generated += 1;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
  }
  return generated;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

/**
 * SYNC-SPEC §6. Called by the bot every 60 s; every step is idempotent and bounded, so a
 * missed or doubled tick changes nothing but timing.
 */
export async function runTick(now = new Date()): Promise<TickCounts> {
  const counts: TickCounts = { generated: 0, rosterAdded: 0, rosterRemoved: 0, posted: 0, reminded: 0, locked: 0, closed: 0, nudged: 0, trialsRaised: 0, reconciled: 0 };
  const roster = await rosterUserIds();

  // 1. Generate instances for every active series.
  counts.generated = await generateInstances(now, roster);

  // 1b. Roster changes: add new roster members to every future SCHEDULED raid; drop the
  // unanswered rows of anyone who left the roster. Answered rows are kept.
  const future = await db.raid.findMany({ where: { status: 'SCHEDULED', startsAt: { gt: now } }, select: { id: true, signups: { select: { userId: true, response: true, standing: true } } } });
  const rosterSet = new Set(roster);
  for (const raid of future) {
    const have = new Set(raid.signups.map((s) => s.userId));
    const missing = roster.filter((u) => !have.has(u));
    if (missing.length > 0) {
      await db.signup.createMany({ data: missing.map((userId) => ({ raidId: raid.id, userId, standing: 'ROSTER' as const, source: 'WEB' as const })), skipDuplicates: true });
      counts.rosterAdded += missing.length;
    }
    const gone = raid.signups.filter((s) => s.standing === 'ROSTER' && s.response === null && !rosterSet.has(s.userId)).map((s) => s.userId);
    if (gone.length > 0) {
      const removed = await db.signup.deleteMany({ where: { raidId: raid.id, userId: { in: gone }, response: null } });
      counts.rosterRemoved += removed.count;
    }
  }

  // 2–5. Post, remind, lock, close. One pass over the raids that are not finished.
  const live = await db.raid.findMany({
    where: { status: { in: ['SCHEDULED', 'LOCKED'] } },
    orderBy: { startsAt: 'asc' },
    select: { id: true, status: true, startsAt: true, durationMin: true, locksAt: true, postedAt: true, remind72At: true, remind24At: true, discordThreadId: true, series: { select: { postAheadDays: true } } },
  });
  for (const raid of live) {
    const postAheadDays = raid.series?.postAheadDays ?? 14;
    if (dueForPost(raid, now, postAheadDays)) {
      // A raid created inside the window is posted at the bottom and marked late (§8).
      const late = raid.startsAt.getTime() - now.getTime() < (postAheadDays - 1) * 24 * HOUR_MS;
      await db.$transaction(async (tx) => {
        await tx.raid.update({ where: { id: raid.id }, data: { postedAt: now } });
        await enqueue('raid.post', { raidId: raid.id, late }, tx);
      });
      counts.posted += 1;
    }
    const reminder = reminderDue(raid, now);
    if (reminder) {
      const unanswered = await db.signup.findMany({ where: { raidId: raid.id, standing: 'ROSTER', response: null }, select: { user: { select: { discordId: true } } } });
      await db.$transaction(async (tx) => {
        await tx.raid.update({ where: { id: raid.id }, data: reminder === 72 ? { remind72At: now } : { remind24At: now } });
        await enqueue('raid.remind', { raidId: raid.id, hours: reminder, discordIds: unanswered.map((s) => s.user.discordId) }, tx);
      });
      counts.reminded += 1;
    }
    if (dueForLock(raid, now)) {
      await db.$transaction(async (tx) => {
        await tx.raid.update({ where: { id: raid.id }, data: { status: 'LOCKED', lockedAt: now } });
        if (raid.discordThreadId) await enqueue('raid.lock', { raidId: raid.id }, tx);
      });
      raid.status = 'LOCKED';
      counts.locked += 1;
    }
    if (dueForClose(raid, now)) {
      await db.$transaction(async (tx) => {
        await tx.raid.update({ where: { id: raid.id }, data: { status: 'DONE' } });
        if (raid.discordThreadId) await enqueue('raid.close', { raidId: raid.id }, tx);
      });
      counts.closed += 1;
    }
  }

  // 6. Nudge officers about applications pending for a day.
  const pending = await db.application.findMany({ where: { status: 'PENDING', nudgedAt: null }, select: { id: true, status: true, createdAt: true, nudgedAt: true, character: true } });
  for (const app of pending) {
    if (!dueForNudge(app, now)) continue;
    await db.$transaction(async (tx) => {
      await tx.application.update({ where: { id: app.id }, data: { nudgedAt: now } });
      await enqueue('application.nudge', { applicationId: app.id, character: app.character }, tx);
    });
    counts.nudged += 1;
  }

  // 6b. Trials: two weeks in (or when an extension runs out), the bot asks officers in
  // #officers to promote or extend, answered through POST /members/:discordId/trial (SYNC-SPEC §3).
  const trials = await db.user.findMany({ where: { rank: 'TRIAL', inGuild: true, trialStartedAt: { not: null }, trialNudgedAt: null }, select: { id: true, discordId: true, rank: true, discordName: true, trialStartedAt: true, trialNudgedAt: true, trialCheckInAt: true } });
  for (const t of trials) {
    const startedAt = t.trialStartedAt;
    if (!startedAt || !trialCheckInDue(t, now)) continue;
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: t.id }, data: { trialNudgedAt: now } });
      await enqueue('trial.checkin', { userId: t.id, discordId: t.discordId, name: t.discordName, startedAt: startedAt.toISOString(), extended: t.trialCheckInAt !== null }, tx);
    });
    counts.trialsRaised += 1;
  }

  // 7. Reconcile once an hour: re-render everything the bot has posted whose state implies
  // archived or locked, so drift in Discord is corrected. The marker is one well-known row
  // in BotRequest (a primary-key read), and the same hour also trims old jobs and keys.
  const marker = await db.botRequest.findUnique({ where: { key: RECONCILE_MARKER }, select: { createdAt: true, body: true } });
  const lastAt = marker ? Date.parse(String((marker.body as { at?: string }).at ?? '')) : NaN;
  if (Number.isNaN(lastAt) || now.getTime() - lastAt >= HOUR_MS) {
    await db.botRequest.upsert({ where: { key: RECONCILE_MARKER }, create: { key: RECONCILE_MARKER, statusCode: 200, body: { at: now.toISOString() } }, update: { body: { at: now.toISOString() } } });
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * HOUR_MS);
    await db.outboxJob.deleteMany({ where: { status: { in: ['DONE', 'FAILED'] }, createdAt: { lt: cutoff } } });
    await db.botRequest.deleteMany({ where: { createdAt: { lt: cutoff }, key: { not: RECONCILE_MARKER } } });
    const raids = await db.raid.findMany({ where: { discordThreadId: { not: null }, status: { in: ['LOCKED', 'DONE', 'CANCELLED'] }, startsAt: { gt: new Date(now.getTime() - 14 * 24 * HOUR_MS) } }, select: { id: true } });
    const apps = await db.application.findMany({ where: { discordThreadId: { not: null }, status: { in: ['ACCEPTED', 'DECLINED'] }, createdAt: { gt: new Date(now.getTime() - 30 * 24 * HOUR_MS) } }, select: { id: true } });
    for (const r of raids) await enqueue('raid.update', { raidId: r.id, reconcile: true });
    for (const a of apps) await enqueue('application.update', { applicationId: a.id, reconcile: true });
    counts.reconciled = raids.length + apps.length;
  }

  return counts;
}
