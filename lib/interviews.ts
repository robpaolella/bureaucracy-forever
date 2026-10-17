import 'server-only';

import { Prisma, type InterviewStatus } from '@/lib/generated/prisma/client';
import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { SITE_URL } from '@/lib/config';
import { isValidStart, pickWindow } from '@/lib/interview-slots';
import { minimumShortfall } from '@/lib/interview-minimum';

/**
 * The interview lifecycle (SYNC-SPEC §12): start, the applicant's times, book, propose and
 * answer, cancel, and the reads. Every change of state is one conditional update on `status` (and `timesRevision`
 * for times) with its jobs in the same transaction, so competing calls get one winner.
 * Callers check who may act: officers in the routes, the applicant by passing their own
 * Discord id from the session or the clicking Discord user.
 */
type Client = Prisma.TransactionClient | typeof db;

export const ACTIVE: InterviewStatus[] = ['AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'BOOKED'];
const EDITABLE: InterviewStatus[] = ['AWAITING_TIMES', 'TIMES_RECEIVED'];
/** More picks than any window holds is a malformed body. */
const MAX_PICKS = 400;
export const INTERVIEW_PAGE_URL = `${SITE_URL}/apply/interview`;

type Person = { discordId: string; name: string } | null;
/** The `GET /interviews/:id` read shape (SYNC-SPEC §4). */
export type InterviewView = {
  id: string; applicationId: string; attempt: number; status: InterviewStatus; endReason: string | null;
  applicant: { discordId: string; characterName: string }; threadId: string | null; timeZone: string | null;
  timesRevision: number; slots: string[]; requestedAt: string; requestedBy: Person; proposedStart: string | null;
  timesUpdatedAt: string | null; proposedBy: Person; bookedStart: string | null; bookedBy: Person; endedAt: string | null; pageUrl: string;
  requestDmId: string | null; timesMessageId: string | null; proposalMessageId: string | null;
  proposalDmId: string | null; bookedMessageId: string | null;
};
export type Refusal = {
  ok: false; status: 400 | 403 | 404 | 409; reason?: string; error: string;
  interview?: InterviewView; earlierDate?: string | null;
};
export type InterviewResult = { ok: true; interview: InterviewView } | Refusal;

const refuse = (status: Refusal['status'], reason: string | undefined, error: string, extra: Partial<Refusal> = {}): Refusal => ({ ok: false, status, ...(reason ? { reason } : {}), error, ...extra });
const notFound = () => refuse(404, undefined, 'Interview not found.');

/** The `error` for a refusal that names where the interview stands. */
export function stateMessage(status: InterviewStatus): string {
  return {
    AWAITING_TIMES: 'This interview is waiting for times.',
    TIMES_RECEIVED: 'Times are in for this interview.',
    PROPOSED: 'An officer has proposed a time for this interview.',
    BOOKED: 'This interview is already booked.',
    DONE: 'This interview has already taken place.',
    CANCELLED: 'This interview was cancelled.',
    NO_TIME: 'No time was found for this interview.',
    CLOSED: 'This interview ended when the application was decided.',
  }[status];
}

const include = { application: { select: { discordId: true, character: true, discordThreadId: true } } } as const;
type Row = Prisma.InterviewGetPayload<{ include: typeof include }>;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function toView(row: Row, client: Client): Promise<InterviewView> {
  const ids = [row.requestedById, row.proposedById, row.bookedById].filter((id): id is string => !!id);
  const users = await client.user.findMany({ where: { id: { in: ids } }, select: { id: true, discordId: true, discordName: true } });
  const person = (id: string | null): Person => {
    const u = users.find((x) => x.id === id);
    return u ? { discordId: u.discordId, name: u.discordName } : null;
  };
  return {
    id: row.id, applicationId: row.applicationId, attempt: row.attempt, status: row.status, endReason: row.endReason,
    applicant: { discordId: row.application.discordId, characterName: row.application.character },
    threadId: row.application.discordThreadId, timeZone: row.timeZone, timesRevision: row.timesRevision,
    slots: row.slots.map((s) => s.toISOString()), requestedAt: row.requestedAt.toISOString(), requestedBy: person(row.requestedById),
    timesUpdatedAt: iso(row.timesUpdatedAt), proposedStart: iso(row.proposedStart), proposedBy: person(row.proposedById), bookedStart: iso(row.bookedStart),
    bookedBy: person(row.bookedById), endedAt: iso(row.endedAt), pageUrl: INTERVIEW_PAGE_URL, requestDmId: row.requestDmId,
    timesMessageId: row.timesMessageId, proposalMessageId: row.proposalMessageId, proposalDmId: row.proposalDmId,
    bookedMessageId: row.bookedMessageId,
  };
}

async function viewById(id: string, client: Client = db): Promise<InterviewView | null> {
  const row = await client.interview.findUnique({ where: { id }, include });
  return row ? toView(row, client) : null;
}

/** `GET /interviews/:id`. */
export const getInterview = (id: string) => viewById(id);

/** An application's latest attempt, without `slots` (the `interview` block of `GET /applications/:id`), or null. */
export async function latestInterview(applicationId: string): Promise<Omit<InterviewView, 'slots'> | null> {
  const row = await db.interview.findFirst({ where: { applicationId }, orderBy: { attempt: 'desc' }, include });
  if (!row) return null;
  const view: Partial<InterviewView> = await toView(row, db);
  delete view.slots;
  return view as Omit<InterviewView, 'slots'>;
}

/** What the officer page's Interview card shows: the latest attempt, and how the one before it ended. */
export type InterviewCard = {
  attempt: number; status: InterviewStatus; endReason: 'DECLINED' | 'EXPIRED' | 'PROPOSAL_LAPSED' | null;
  requestedBy: string | null; requestedAt: string; windowEnd: string; slots: string[]; timesUpdatedAt: string | null;
  proposedBy: string | null; proposedStart: string | null; bookedBy: string | null; bookedStart: string | null;
  endedBy: string | null; endedAt: string | null;
  earlier: { status: InterviewStatus; at: string } | null;
};

/** An application's interview for the officer page, or null when it never had one. */
export async function interviewCard(applicationId: string): Promise<InterviewCard | null> {
  const [row, before] = await db.interview.findMany({ where: { applicationId }, orderBy: { attempt: 'desc' }, take: 2 });
  if (!row) return null;
  const ids = [row.requestedById, row.proposedById, row.bookedById, row.endedById].filter((id): id is string => !!id);
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, discordName: true } });
  const name = (id: string | null) => users.find((u) => u.id === id)?.discordName ?? null;
  return {
    attempt: row.attempt, status: row.status, endReason: row.endReason,
    requestedBy: name(row.requestedById), requestedAt: row.requestedAt.toISOString(), windowEnd: row.windowEnd.toISOString(),
    slots: row.slots.map((s) => s.toISOString()), timesUpdatedAt: iso(row.timesUpdatedAt),
    proposedBy: name(row.proposedById), proposedStart: iso(row.proposedStart), bookedBy: name(row.bookedById), bookedStart: iso(row.bookedStart),
    endedBy: name(row.endedById), endedAt: iso(row.endedAt),
    // A finished interview is dated by when it took place; any other by when it ended.
    earlier: before ? { status: before.status, at: (before.status === 'DONE' ? before.bookedStart ?? before.endedAt ?? before.requestedAt : before.endedAt ?? before.requestedAt).toISOString() } : null,
  };
}

/**
 * The signed-in applicant's interview for their page: the active attempt on any of their
 * applications, else the most recently requested ended one, else null.
 */
export async function applicantInterview(discordId: string): Promise<InterviewView | null> {
  const mine = { application: { discordId } };
  const row = (await db.interview.findFirst({ where: { ...mine, activeKey: { not: null } }, include }))
    ?? (await db.interview.findFirst({ where: mine, orderBy: { requestedAt: 'desc' }, include }));
  return row ? toView(row, db) : null;
}

/**
 * Start an interview on a pending application (`POST /applications/:id/interview`). Locks the
 * application row, so a start and a decision, or two starts, run one after the other.
 */
export async function startInterview(applicationId: string, by: { userId: string }, options: { confirmSecond?: boolean; now?: Date } = {}): Promise<InterviewResult> {
  const now = options.now ?? new Date();
  try {
    return await db.$transaction(async (tx): Promise<InterviewResult> => {
      const [app] = await tx.$queryRaw<{ status: string; character: string }[]>`SELECT "status"::text AS "status", "character" FROM "Application" WHERE "id" = ${applicationId} FOR NO KEY UPDATE`;
      if (!app) return refuse(404, undefined, 'Application not found.');
      if (app.status !== 'PENDING') return refuse(409, 'not_pending', `${app.character}'s application has already been decided.`);
      const earlier = await tx.interview.findMany({ where: { applicationId }, orderBy: { attempt: 'desc' }, select: { id: true, attempt: true, status: true, activeKey: true, bookedStart: true } });
      const active = earlier.find((i) => i.activeKey);
      if (active) return refuse(409, 'already_active', `${app.character} already has an interview in progress.`, { interview: (await viewById(active.id, tx))! });
      const done = earlier.find((i) => i.status === 'DONE');
      if (done && !options.confirmSecond) {
        return refuse(409, 'second_not_confirmed', `${app.character} already had an interview.`, { earlierDate: iso(done.bookedStart) });
      }
      const row = await tx.interview.create({
        data: { applicationId, attempt: (earlier[0]?.attempt ?? 0) + 1, activeKey: applicationId, requestedById: by.userId, requestedAt: now, ...pickWindow(now) },
        include,
      });
      await enqueue('interview.request', { applicationId, interviewId: row.id }, tx);
      // A new attempt after a DONE one takes the Interview tag off (SYNC-SPEC §8).
      if (done) await enqueue('application.update', { applicationId }, tx);
      return { ok: true, interview: await toView(row, tx) };
    });
  } catch (error) {
    // Backstop for the lock: the database refuses a second active attempt.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    const active = await db.interview.findFirst({ where: { activeKey: applicationId }, include });
    if (!active) throw error;
    return refuse(409, 'already_active', `${active.application.character} already has an interview in progress.`, { interview: await toView(active, db) });
  }
}

type Parsed = { ok: true; slots: Date[]; timeZone: string } | Refusal;

function parsePicks(picks: unknown, timeZone: unknown, window: { windowStart: Date; windowEnd: Date }): Parsed {
  const invalid = (error: string) => refuse(400, 'invalid', error);
  if (!Array.isArray(picks) || picks.length === 0) return invalid('Pick at least one time.');
  if (picks.length > MAX_PICKS) return invalid('Too many times.');
  if (typeof timeZone !== 'string' || !timeZone) return invalid('Send your time zone.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    return invalid('Unknown time zone.');
  }
  const times = new Set<number>();
  for (const pick of picks) {
    const t = typeof pick === 'string' ? new Date(pick) : null;
    if (!t || Number.isNaN(t.getTime())) return invalid('Send times as ISO dates.');
    if (!isValidStart(t, { kind: 'pick', ...window })) return refuse(400, 'out_of_range', 'Pick half-hour start times within the next week.');
    times.add(t.getTime());
  }
  const slots = [...times].sort((a, b) => a - b).map((t) => new Date(t));
  const short = minimumShortfall(slots);
  if (short) return refuse(400, 'too_few_times', short);
  return { ok: true, slots, timeZone };
}

const TIMES_CHANGED = 'Your times changed while you were editing. Check them and submit again.';

/**
 * The applicant submits or changes their times. Only that interview's applicant may; an
 * identical set changes nothing and enqueues nothing. `expectedRevision`, when given, is the
 * times revision the caller last saw: any other refuses, so times sent elsewhere are never
 * overwritten unseen.
 */
export async function submitTimes(interviewId: string, applicantDiscordId: string, picks: unknown, timeZone: unknown, now = new Date(), expectedRevision?: number): Promise<InterviewResult> {
  const row = await db.interview.findUnique({ where: { id: interviewId }, include });
  if (!row) return notFound();
  if (row.application.discordId !== applicantDiscordId) return refuse(403, 'forbidden', 'This interview belongs to someone else.');
  if (!EDITABLE.includes(row.status)) return refuse(409, 'wrong_status', stateMessage(row.status));
  if (expectedRevision !== undefined && row.timesRevision !== expectedRevision) return refuse(409, 'wrong_status', TIMES_CHANGED);
  const parsed = parsePicks(picks, timeZone, row);
  if (!parsed.ok) return parsed;
  const sameAs = (slots: Date[]) => slots.length === parsed.slots.length && slots.every((s, i) => s.getTime() === parsed.slots[i].getTime());
  if (row.status === 'TIMES_RECEIVED' && sameAs(row.slots)) return { ok: true, interview: await toView(row, db) };
  const won = await db.$transaction(async (tx) => {
    const updated = await tx.interview.updateMany({
      where: { id: row.id, status: row.status, timesRevision: row.timesRevision },
      data: { status: 'TIMES_RECEIVED', slots: parsed.slots, timeZone: parsed.timeZone, timesRevision: row.timesRevision + 1, timesSubmittedAt: row.timesSubmittedAt ?? now, timesUpdatedAt: now },
    });
    if (updated.count === 0) return false;
    await enqueue('interview.times', { applicationId: row.applicationId, interviewId: row.id }, tx);
    return true;
  });
  const latest = (await db.interview.findUnique({ where: { id: row.id }, include }))!;
  if (won) return { ok: true, interview: await toView(latest, db) };
  // Lost to another change. The same times arriving twice is not a conflict.
  if (latest.status === 'TIMES_RECEIVED' && sameAs(latest.slots)) return { ok: true, interview: await toView(latest, db) };
  return refuse(409, 'wrong_status', EDITABLE.includes(latest.status) ? TIMES_CHANGED : stateMessage(latest.status));
}

/** An officer cancels an active interview (`POST /interviews/:id/cancel`). */
export async function cancelInterview(interviewId: string, by: { userId: string }, now = new Date()): Promise<InterviewResult> {
  const row = await db.interview.findUnique({ where: { id: interviewId }, select: { id: true, applicationId: true, status: true } });
  if (!row) return notFound();
  if (!ACTIVE.includes(row.status)) return refuse(409, 'not_active', stateMessage(row.status));
  const won = await db.$transaction(async (tx) => {
    const updated = await tx.interview.updateMany({ where: { id: row.id, status: row.status }, data: { status: 'CANCELLED', activeKey: null, endedAt: now, endedById: by.userId } });
    if (updated.count === 0) return false;
    await enqueue('interview.ended', { applicationId: row.applicationId, interviewId: row.id, outcome: 'cancelled' }, tx);
    // Cancelling a booking takes the Interview tag off (SYNC-SPEC §8).
    if (row.status === 'BOOKED') await enqueue('application.update', { applicationId: row.applicationId }, tx);
    return true;
  });
  const latest = (await viewById(row.id))!;
  if (won) return { ok: true, interview: latest };
  // Lost to another change: name where it stands now rather than acting on it.
  return refuse(409, ACTIVE.includes(latest.status) ? 'wrong_status' : 'not_active', stateMessage(latest.status));
}

const instant = (value: unknown): Date | null => {
  const t = typeof value === 'string' ? new Date(value) : null;
  return t && !Number.isNaN(t.getTime()) ? t : null;
};
const TOO_SOON = 'That time starts in less than 15 minutes.';

/** A booking enqueues the booking and puts the Interview tag on (SYNC-SPEC §8). */
async function enqueueBooked(row: { id: string; applicationId: string }, startsAt: Date, tx: Prisma.TransactionClient) {
  await enqueue('interview.booked', { applicationId: row.applicationId, interviewId: row.id, startsAt: startsAt.toISOString() }, tx);
  await enqueue('application.update', { applicationId: row.applicationId }, tx);
}

/**
 * An officer books one of the applicant's current times (`POST /interviews/:id/book`). The
 * booking wins only if the times are still the revision the officer picked from.
 */
export async function bookInterview(interviewId: string, by: { userId: string }, startsAt: unknown, timesRevision: unknown, now = new Date()): Promise<InterviewResult> {
  const row = await db.interview.findUnique({ where: { id: interviewId }, include });
  if (!row) return notFound();
  const start = instant(startsAt);
  if (!start || !Number.isInteger(timesRevision)) return refuse(400, 'invalid', 'Send a start time and the times revision.');
  if (row.status !== 'TIMES_RECEIVED') return refuse(409, 'wrong_status', stateMessage(row.status));
  const timesChanged = () => refuse(409, 'times_changed', `${row.application.character} changed their times. Pick again.`);
  if (timesRevision !== row.timesRevision) return timesChanged();
  if (!row.slots.some((s) => s.getTime() === start.getTime())) return refuse(409, 'not_a_slot', `That isn't one of ${row.application.character}'s times.`);
  if (!isValidStart(start, { kind: 'book', now })) return refuse(409, 'too_soon', `${TOO_SOON} Pick a later one.`);
  const won = await db.$transaction(async (tx) => {
    const updated = await tx.interview.updateMany({
      where: { id: row.id, status: 'TIMES_RECEIVED', timesRevision: row.timesRevision },
      data: { status: 'BOOKED', bookedStart: start, bookedById: by.userId, bookedAt: now },
    });
    if (updated.count === 0) return false;
    await enqueueBooked(row, start, tx);
    return true;
  });
  const latest = (await viewById(row.id))!;
  if (won) return { ok: true, interview: latest };
  // Lost to another change: the applicant's edit, or another officer's click.
  return latest.status === 'TIMES_RECEIVED' ? timesChanged() : refuse(409, 'wrong_status', stateMessage(latest.status));
}

/** An officer proposes another time (`POST /interviews/:id/propose`); one proposal per attempt. */
export async function proposeTime(interviewId: string, by: { userId: string }, startsAt: unknown, now = new Date()): Promise<InterviewResult> {
  const row = await db.interview.findUnique({ where: { id: interviewId }, select: { id: true, applicationId: true, status: true } });
  if (!row) return notFound();
  const start = instant(startsAt);
  if (!start) return refuse(400, 'invalid', 'Send a start time.');
  if (row.status !== 'TIMES_RECEIVED') return refuse(409, 'wrong_status', stateMessage(row.status));
  if (!isValidStart(start, { kind: 'propose', now })) return refuse(400, 'out_of_range', 'Propose a half-hour start time from 2 hours to 7 days ahead.');
  const won = await db.$transaction(async (tx) => {
    const updated = await tx.interview.updateMany({
      where: { id: row.id, status: 'TIMES_RECEIVED' },
      data: { status: 'PROPOSED', proposedStart: start, proposedById: by.userId, proposedAt: now },
    });
    if (updated.count === 0) return false;
    await enqueue('interview.proposed', { applicationId: row.applicationId, interviewId: row.id, startsAt: start.toISOString() }, tx);
    return true;
  });
  const latest = (await viewById(row.id))!;
  return won ? { ok: true, interview: latest } : refuse(409, 'wrong_status', stateMessage(latest.status));
}

/**
 * The applicant accepts or declines the proposal (`POST /interviews/:id/answer`). Accepting
 * books the proposed start with the proposer as the booking officer.
 */
export async function answerProposal(interviewId: string, applicantDiscordId: string, answer: unknown, now = new Date()): Promise<InterviewResult> {
  const row = await db.interview.findUnique({ where: { id: interviewId }, include });
  if (!row) return notFound();
  if (row.application.discordId !== applicantDiscordId) return refuse(403, 'forbidden', 'This interview belongs to someone else.');
  if (answer !== 'accept' && answer !== 'decline') return refuse(400, 'invalid', 'Answer accept or decline.');
  if (row.status !== 'PROPOSED' || !row.proposedStart) return refuse(409, 'wrong_status', stateMessage(row.status));
  const start = row.proposedStart;
  // Declining still works in the last 15 minutes; the tick lapses an unanswered one at the start.
  if (answer === 'accept' && !isValidStart(start, { kind: 'book', now })) return refuse(409, 'too_soon', `${TOO_SOON} An officer will reach out to arrange another.`);
  const applicant = answer === 'decline' ? await db.user.findUnique({ where: { discordId: applicantDiscordId }, select: { id: true } }) : null;
  const won = await db.$transaction(async (tx) => {
    const updated = await tx.interview.updateMany({
      where: { id: row.id, status: 'PROPOSED' },
      data: answer === 'accept'
        ? { status: 'BOOKED', bookedStart: start, bookedById: row.proposedById, bookedAt: now }
        : { status: 'NO_TIME', endReason: 'DECLINED', activeKey: null, endedAt: now, endedById: applicant?.id ?? null },
    });
    if (updated.count === 0) return false;
    if (answer === 'accept') await enqueueBooked(row, start, tx);
    else await enqueue('interview.ended', { applicationId: row.applicationId, interviewId: row.id, outcome: 'declined' }, tx);
    return true;
  });
  const latest = (await viewById(row.id))!;
  return won ? { ok: true, interview: latest } : refuse(409, 'wrong_status', stateMessage(latest.status));
}

/**
 * Close an application's active interview as part of its decision, inside the decision's
 * transaction. Returns the closed interview's id, or null when none was active.
 */
export async function closeActiveInterview(applicationId: string, byUserId: string, now: Date, tx: Prisma.TransactionClient): Promise<string | null> {
  const active = await tx.interview.findFirst({ where: { activeKey: applicationId }, select: { id: true } });
  if (!active) return null;
  const closed = await tx.interview.updateMany({ where: { id: active.id, status: { in: ACTIVE } }, data: { status: 'CLOSED', activeKey: null, endedAt: now, endedById: byUserId } });
  if (closed.count === 0) return null;
  await enqueue('interview.ended', { applicationId, interviewId: active.id, outcome: 'closed' }, tx);
  return active.id;
}
