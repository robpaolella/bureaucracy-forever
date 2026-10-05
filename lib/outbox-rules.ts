/**
 * Outbox scheduling rules (SYNC-SPEC §4 /outbox, §5). Pure, so the backoff and the lock
 * timeout are unit-tested apart from the database.
 */
export const MAX_ATTEMPTS = 5;
/** A RUNNING job the bot never acked is handed out again after this long. */
export const LOCK_TIMEOUT_MS = 5 * 60_000;

export type JobType =
  | 'application.post'
  | 'application.update'
  | 'application.note.post'
  | 'application.note.edit'
  | 'application.note.delete'
  | 'application.decide'
  | 'application.reopen'
  | 'application.nudge'
  | 'raid.post'
  | 'raid.update'
  | 'raid.remind'
  | 'raid.reserves.remind'
  | 'raid.lock'
  | 'raid.cancel'
  | 'raid.close'
  | 'raid.delete'
  | 'member.roles.sync'
  | 'trial.checkin'
  | 'officers.notify';

/** `{ ok: false }` acks: PENDING again after 2^attempts minutes, FAILED after the fifth try. */
export function nextAttempt(attempts: number, now: Date): { status: 'PENDING' | 'FAILED'; attempts: number; runAfter: Date } {
  const next = attempts + 1;
  if (next >= MAX_ATTEMPTS) return { status: 'FAILED', attempts: next, runAfter: now };
  return { status: 'PENDING', attempts: next, runAfter: new Date(now.getTime() + 2 ** next * 60_000) };
}

/** Which claimed jobs count as abandoned by the bot. */
export function lockExpired(lockedAt: Date | null, now: Date): boolean {
  return lockedAt !== null && now.getTime() - lockedAt.getTime() > LOCK_TIMEOUT_MS;
}

/** The ack body the bot sends. */
export type AckBody = { ok: true; result?: Record<string, unknown> } | { ok: false; error: string };

export function parseAck(body: unknown): AckBody | null {
  const b = (body && typeof body === 'object' ? body : null) as Record<string, unknown> | null;
  if (!b || typeof b.ok !== 'boolean') return null;
  if (b.ok) return { ok: true, result: b.result && typeof b.result === 'object' ? (b.result as Record<string, unknown>) : undefined };
  return { ok: false, error: typeof b.error === 'string' && b.error ? b.error.slice(0, 1000) : 'unknown error' };
}

/**
 * SYNC-SPEC §5: one job per entity in flight. Given the candidates in claim order and the
 * entities that already have a fresh RUNNING job, keep only the first candidate per free
 * entity; the rest wait for the next poll.
 */
export function oneJobPerEntity<T extends { entity: string }>(candidates: T[], busy: ReadonlySet<string>): T[] {
  const taken = new Set(busy);
  const out: T[] = [];
  for (const c of candidates) {
    if (taken.has(c.entity)) continue;
    taken.add(c.entity);
    out.push(c);
  }
  return out;
}

/** The entity a job belongs to, so the bot can order work per entity. */
export function entityKey(type: JobType, payload: Record<string, unknown>): string {
  if (type.startsWith('application.')) return `application:${String(payload.applicationId ?? '')}`;
  if (type.startsWith('raid.')) return `raid:${String(payload.raidId ?? '')}`;
  if (type === 'member.roles.sync' || type === 'trial.checkin') return `member:${String(payload.discordId ?? '')}`;
  return 'officers';
}
