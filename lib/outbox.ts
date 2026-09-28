import 'server-only';

import type { Prisma } from '@/lib/generated/prisma/client';
import { db } from '@/lib/db';
import { entityKey, lockExpired, LOCK_TIMEOUT_MS, nextAttempt, oneJobPerEntity, type AckBody, type JobType } from './outbox-rules';

type Tx = Prisma.TransactionClient;

/**
 * Queue a job for the bot (SYNC-SPEC §5). Accepts a transaction client so a write and its
 * job land together. Never throws for the caller's sake beyond the database itself.
 */
export async function enqueue(type: JobType, payload: Record<string, unknown>, tx: Tx | typeof db = db): Promise<string> {
  const job = await tx.outboxJob.create({ data: { type, payload: payload as Prisma.InputJsonValue }, select: { id: true } });
  return job.id;
}

export type ClaimedJob = { id: string; type: string; payload: unknown; attempts: number; entity: string; createdAt: string };

/**
 * GET /outbox: hand out up to `limit` due jobs, oldest first, one per entity, marking them
 * RUNNING. Jobs whose lock is older than five minutes are handed out again. Two concurrent
 * polls cannot take the same job: the update is conditional on the status the poll saw.
 */
export async function claimJobs(limit: number, now = new Date()): Promise<ClaimedJob[]> {
  const stale = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const candidates = await db.outboxJob.findMany({
    where: { OR: [{ status: 'PENDING', runAfter: { lte: now } }, { status: 'RUNNING', lockedAt: { lt: stale } }] },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, type: true, payload: true, attempts: true, status: true, lockedAt: true, createdAt: true },
  });
  // §5: never two jobs for one entity in flight. Entities with a fresh RUNNING job are busy;
  // within this batch only the oldest job per entity goes out.
  const inFlight = await db.outboxJob.findMany({ where: { status: 'RUNNING', lockedAt: { gte: stale } }, select: { type: true, payload: true } });
  const busy = new Set(inFlight.map((j) => entityKey(j.type as JobType, (j.payload ?? {}) as Record<string, unknown>)));
  const eligible = oneJobPerEntity(candidates.map((job) => ({ ...job, entity: entityKey(job.type as JobType, (job.payload ?? {}) as Record<string, unknown>) })), busy);
  const claimed: ClaimedJob[] = [];
  for (const job of eligible) {
    const abandoned = job.status === 'RUNNING' && lockExpired(job.lockedAt, now);
    const taken = await db.outboxJob.updateMany({
      where: job.status === 'PENDING' ? { id: job.id, status: 'PENDING' } : { id: job.id, status: 'RUNNING', lockedAt: job.lockedAt },
      data: { status: 'RUNNING', lockedAt: now },
    });
    if (taken.count === 0) continue;
    claimed.push({ id: job.id, type: job.type, payload: job.payload, attempts: job.attempts + (abandoned ? 1 : 0), entity: job.entity, createdAt: job.createdAt.toISOString() });
  }
  return claimed;
}

export type AckOutcome = { status: 'DONE' | 'PENDING' | 'FAILED'; applied?: string };

/**
 * POST /outbox/:id/ack. Success stores the result and applies it (§5, "Site applies
 * result"); failure backs off or fails the job. Acking a job twice is harmless: a DONE job
 * stays DONE.
 */
export async function ackJob(id: string, ack: AckBody, now = new Date()): Promise<AckOutcome | null> {
  const job = await db.outboxJob.findUnique({ where: { id }, select: { id: true, type: true, payload: true, attempts: true, status: true } });
  if (!job) return null;
  if (job.status === 'DONE' || job.status === 'FAILED') return { status: job.status };
  if (ack.ok) {
    const applied = await applyResult(job.type as JobType, (job.payload ?? {}) as Record<string, unknown>, ack.result ?? {});
    await db.outboxJob.update({ where: { id }, data: { status: 'DONE', result: (ack.result ?? {}) as Prisma.InputJsonValue, lockedAt: null, lastError: null } });
    return { status: 'DONE', applied };
  }
  // A raid job that failed because an officer deleted the raid has nothing left to retry.
  if (job.type.startsWith('raid.') && job.type !== 'raid.delete' && !(await raidExists((job.payload ?? {}) as Record<string, unknown>))) {
    await db.outboxJob.update({ where: { id }, data: { status: 'DONE', lockedAt: null, lastError: `raid deleted: ${ack.error}` } });
    return { status: 'DONE' };
  }
  const next = nextAttempt(job.attempts, now);
  await db.outboxJob.update({ where: { id }, data: { status: next.status, attempts: next.attempts, runAfter: next.runAfter, lockedAt: null, lastError: ack.error } });
  if (next.status === 'FAILED') {
    await enqueue('officers.notify', { text: `Sync job ${job.type} failed after ${next.attempts} attempts: ${ack.error}`, jobId: id });
  }
  return { status: next.status };
}

async function raidExists(payload: Record<string, unknown>): Promise<boolean> {
  return (await db.raid.count({ where: { id: String(payload.raidId ?? '') } })) > 0;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** SYNC-SPEC §5 "Site applies result": store the Discord ids the bot created. */
async function applyResult(type: JobType, payload: Record<string, unknown>, result: Record<string, unknown>): Promise<string | undefined> {
  const threadId = str(result.threadId);
  const messageId = str(result.messageId);
  if (type === 'application.post' && threadId) {
    await db.application.updateMany({ where: { id: String(payload.applicationId) }, data: { discordThreadId: threadId, discordMessageId: messageId } });
    return 'application ids stored';
  }
  if (type === 'raid.post' && threadId) {
    const stored = await db.raid.updateMany({ where: { id: String(payload.raidId) }, data: { discordThreadId: threadId, discordMessageId: messageId } });
    // Deleted while the bot was posting it: take the post down again.
    if (stored.count === 0) {
      await enqueue('raid.delete', { raidId: String(payload.raidId), threadId, messageId });
      return 'raid gone, post removed';
    }
    return 'raid ids stored';
  }
  if (type === 'application.note.post' && messageId) {
    await db.officerNote.updateMany({ where: { id: String(payload.noteId) }, data: { discordMessageId: messageId } });
    return 'note id stored';
  }
  return undefined;
}
