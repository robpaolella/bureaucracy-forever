import 'server-only';

import { GUILD_TIMEZONE } from '@/lib/config';
import { db } from '@/lib/db';
import { latestAttempt, reminderActivityTime, reminderLine, reminderQuiet, type ReminderApplication, type ReminderLine } from '@/lib/tick-rules';
import { zonedParts } from '@/lib/time';

/** `GET /applications/:id` `reminder` block (SYNC-SPEC §6 step 14, Fresh check). */
export type ReminderRead = {
  pending: { key: string; line: ReminderLine; at: string; interviewId: string | null } | null;
  live: { channelId: string; messageId: string } | null;
};

/** The Pacific calendar day of `date` as "YYYY-MM-DD". */
export function pacificDay(date: Date): string {
  const p = zonedParts(date, GUILD_TIMEZONE);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** A key is `<activity time ISO>@<Pacific day>`; null when it isn't one. */
export function parseReminderKey(key: string): { activityAt: Date; day: string } | null {
  const m = /^(.+)@(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (!m) return null;
  const activityAt = new Date(m[1]);
  return Number.isNaN(activityAt.getTime()) ? null : { activityAt, day: m[2] };
}

/**
 * The outstanding reminder while its key is still valid: application pending, activity time
 * unchanged since the key, not quiet, and not past midnight Pacific of the key's day.
 */
export function pendingReminder(
  app: ReminderApplication<ReminderApplication['interviews'][number] & { id: string }> & { status: string; reminderKey: string | null },
  now: Date,
): ReminderRead['pending'] {
  if (!app.reminderKey || app.status !== 'PENDING') return null;
  const key = parseReminderKey(app.reminderKey);
  if (!key || reminderQuiet(app)) return null;
  if (reminderActivityTime(app).getTime() !== key.activityAt.getTime()) return null;
  if (pacificDay(now) > key.day) return null;
  const line = reminderLine(app);
  if (!line) return null;
  return { key: app.reminderKey, line: line.line, at: line.at.toISOString(), interviewId: latestAttempt(app.interviews)?.id ?? null };
}

/** The reminder block for one application, or null when it doesn't exist. */
export async function loadReminder(applicationId: string, now = new Date()): Promise<ReminderRead | null> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true, createdAt: true, reopenedAt: true, reminderKey: true, reminderChannelId: true, reminderMessageId: true,
      notes: { select: { createdAt: true } },
      interviews: { select: { id: true, attempt: true, status: true, requestedAt: true, timesUpdatedAt: true, proposedAt: true, bookedAt: true, bookedStart: true, endedAt: true } },
    },
  });
  if (!app) return null;
  return {
    pending: pendingReminder(app, now),
    live: app.reminderChannelId && app.reminderMessageId ? { channelId: app.reminderChannelId, messageId: app.reminderMessageId } : null,
  };
}

/**
 * Apply the ack of a keyed `application.nudge` (SYNC-SPEC §6 step 14). Each write is one
 * conditional update on the outstanding key, so a stale or repeated ack changes nothing and
 * two racing acks apply once.
 */
export async function applyNudgeAck(applicationId: string, key: string, result: Record<string, unknown>): Promise<string> {
  const parsed = parseReminderKey(key);
  const channelId = typeof result.channelId === 'string' && result.channelId ? result.channelId : null;
  const messageId = typeof result.messageId === 'string' && result.messageId ? result.messageId : null;
  if (typeof result.skipped === 'string' && result.skipped) {
    const cleared = await db.application.updateMany({ where: { id: applicationId, reminderKey: key }, data: { reminderKey: null } });
    return cleared.count ? 'reminder skipped' : 'stale reminder ignored';
  }
  // Neither ids nor a skip: leave the key in place rather than lose a reminder that is still valid.
  if (!parsed || !channelId || !messageId) return 'reminder result ignored';
  const stored = { reminderKey: null, reminderChannelId: channelId, reminderMessageId: messageId, reminderLastOn: parsed.day };
  // Same activity time: one more reminder. A new one restarts the count at 1.
  const counted = await db.application.updateMany({
    where: { id: applicationId, reminderKey: key, reminderActivityAt: parsed.activityAt },
    data: { ...stored, reminderCount: { increment: 1 } },
  });
  if (counted.count) return 'reminder recorded';
  const restarted = await db.application.updateMany({
    where: { id: applicationId, reminderKey: key },
    data: { ...stored, reminderCount: 1, reminderActivityAt: parsed.activityAt },
  });
  return restarted.count ? 'reminder recorded' : 'stale reminder ignored';
}
