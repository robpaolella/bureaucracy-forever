/**
 * The officer–applicant relay's rules (SYNC-SPEC §13). Pure, so the send-time window and the
 * DM checks are unit-tested apart from the database.
 */
export const APPLICANT_DM_MAX = 4000;
export const MAX_ATTACHMENTS = 10;

const SNOWFLAKE = /^\d{17,20}$/;
const isSnowflake = (v: unknown): v is string => typeof v === 'string' && SNOWFLAKE.test(v);

export type Attachment = { id: string; filename: string; size: number; spoiler: boolean };
export type ApplicantDm = { discordId: string; dmChannelId: string; dmMessageId: string; body: string; createdAt: Date; attachments: Attachment[] };

function parseAttachment(v: unknown): Attachment | null {
  const a = (v && typeof v === 'object' ? v : null) as Record<string, unknown> | null;
  if (!a || !isSnowflake(a.id) || typeof a.filename !== 'string' || !a.filename || a.filename.length > 1024) return null;
  if (typeof a.size !== 'number' || !Number.isSafeInteger(a.size) || a.size < 0 || typeof a.spoiler !== 'boolean') return null;
  return { id: a.id, filename: a.filename, size: a.size, spoiler: a.spoiler };
}

/**
 * `POST /applicant-messages` body, or the `error` for a 400 `invalid`. The text is kept as
 * sent; whitespace-only counts as empty, which is valid only with an attachment. Length counts
 * characters (code points), so an emoji is one, never refusing a DM Discord allowed.
 */
export function parseApplicantDm(body: Record<string, unknown>): { ok: true; dm: ApplicantDm } | { ok: false; error: string } {
  const { discordId, dmChannelId, dmMessageId } = body;
  if (!isSnowflake(discordId)) return { ok: false, error: 'discordId must be a Discord id.' };
  if (!isSnowflake(dmChannelId)) return { ok: false, error: 'dmChannelId must be a Discord id.' };
  if (!isSnowflake(dmMessageId)) return { ok: false, error: 'dmMessageId must be a Discord id.' };
  const createdAt = typeof body.createdAt === 'string' ? new Date(body.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return { ok: false, error: 'createdAt must be a date and time.' };
  const text = body.body ?? '';
  if (typeof text !== 'string') return { ok: false, error: 'body must be text.' };
  if ([...text].length > APPLICANT_DM_MAX) return { ok: false, error: `body is over ${APPLICANT_DM_MAX} characters.` };
  const raw = body.attachments ?? [];
  if (!Array.isArray(raw)) return { ok: false, error: 'attachments must be a list.' };
  if (raw.length > MAX_ATTACHMENTS) return { ok: false, error: `At most ${MAX_ATTACHMENTS} attachments.` };
  const attachments = raw.map(parseAttachment);
  if (attachments.some((a) => a === null)) return { ok: false, error: 'Each attachment needs an id, filename, size and spoiler.' };
  if (!text.trim() && attachments.length === 0) return { ok: false, error: 'A DM needs text or an attachment.' };
  return { ok: true, dm: { discordId, dmChannelId, dmMessageId, body: text, createdAt, attachments: attachments as Attachment[] } };
}

export type WindowApplication = { status: string; createdAt: Date; reopenedAt: Date | null; decidedAt: Date | null };

/**
 * Whether the application was `PENDING` when the DM was sent (§13). The site keeps no status
 * history, so it is worked out from the application's own times: the DM is later than its
 * `createdAt` and latest `reopenedAt`, and the application is `PENDING` now or the DM is
 * earlier than `decidedAt` (reopening clears it). A DM sent while pending that reaches the site
 * after the decision is still in the window.
 */
export function inRelayWindow(app: WindowApplication, sentAt: Date): boolean {
  const t = sentAt.getTime();
  if (t <= app.createdAt.getTime()) return false;
  if (app.reopenedAt && t <= app.reopenedAt.getTime()) return false;
  if (app.status === 'PENDING') return true;
  return app.decidedAt !== null && t < app.decidedAt.getTime();
}

/** A relay ping is skipped when the last one is under this old (§13). */
export const PING_QUIET_MS = 10 * 60 * 1000;

export type PingInput = {
  direction: string;
  copyMessageId: string | null;
  relayPingAt: Date | null;
  /** The officer who most recently messaged this applicant, if any. */
  lastOfficer: { discordId: string; role: string } | null;
};

/**
 * What an applicant-message copy may mention (§13): `null` for an officer's message, a message
 * that already has a copy (edits and deletes never re-ping) or a ping under 10 minutes ago;
 * otherwise the last messaging officer's Discord id while they are still an OFFICER, else
 * `"role"` (the Officer role).
 */
export function relayPing(m: PingInput, now = new Date()): string | null {
  if (m.direction === 'TO_APPLICANT' || m.copyMessageId) return null;
  if (m.relayPingAt && now.getTime() - m.relayPingAt.getTime() < PING_QUIET_MS) return null;
  return m.lastOfficer && m.lastOfficer.role === 'OFFICER' ? m.lastOfficer.discordId : 'role';
}

/**
 * `PATCH /applicant-messages/:dmMessageId` body (§13): only `body` is read, with the new-DM
 * length rule. Empty (or whitespace-only) text is valid only when the stored message has an
 * attachment; attachments in an edit are ignored.
 */
export function parseApplicantEdit(body: Record<string, unknown>, storedAttachmentCount: number): { ok: true; text: string } | { ok: false; error: string } {
  const text = body.body ?? '';
  if (typeof text !== 'string') return { ok: false, error: 'body must be text.' };
  if ([...text].length > APPLICANT_DM_MAX) return { ok: false, error: `body is over ${APPLICANT_DM_MAX} characters.` };
  if (!text.trim() && storedAttachmentCount === 0) return { ok: false, error: 'A DM needs text or an attachment.' };
  return { ok: true, text };
}

export const OFFICER_MESSAGE_MAX = 1500;
export const NOT_PENDING_ERROR = "This application has been decided, so I can't pass messages on. DM them yourself if you need to.";

/**
 * An officer's message text (§13): trimmed, then 1–1,500 characters (code points, as Discord's
 * popup counts them), or the `error` for a 400 `invalid`.
 */
export function parseOfficerMessage(body: unknown): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof body !== 'string') return { ok: false, error: 'body must be text.' };
  const text = body.trim();
  if (!text) return { ok: false, error: 'The message is empty.' };
  if ([...text].length > OFFICER_MESSAGE_MAX) return { ok: false, error: `The message is over ${OFFICER_MESSAGE_MAX} characters.` };
  return { ok: true, text };
}

export type SendOutcome = { status: 'SENT'; dmChannelId: string; dmMessageId: string } | { status: 'NOT_DELIVERED' } | { status: 'NOT_SENT' };

/**
 * What an `application.message.send` ack sets (§13): the DM ids → `SENT`, `{ dmDelivered:
 * false }` → `NOT_DELIVERED`, `{ notSent: true }` → `NOT_SENT`. A `{ skipped }` or anything
 * else is null and changes nothing.
 */
export function sendOutcome(result: Record<string, unknown>): SendOutcome | null {
  if (isSnowflake(result.dmChannelId) && isSnowflake(result.dmMessageId)) return { status: 'SENT', dmChannelId: result.dmChannelId, dmMessageId: result.dmMessageId };
  if (result.dmDelivered === false) return { status: 'NOT_DELIVERED' };
  if (result.notSent === true) return { status: 'NOT_SENT' };
  return null;
}
