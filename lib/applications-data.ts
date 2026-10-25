import 'server-only';

import type { ApplicationPath } from '@/components/recruitment/form-state';
import { type AppStatus, type InboxItem } from '@/lib/applications-inbox';
import { db } from '@/lib/db';
import { decisionDm } from '@/content/dm-templates';
import { discordThreadUrl } from '@/lib/discord-links';
import { mentionedUserIds } from '@/lib/discord-mentions';
import { interviewCard, type InterviewCard } from '@/lib/interviews';
import { parseMentions as parseStoredMentions, type Mentions } from '@/lib/mentions-input';
import type { WowClass } from '@/lib/design/class-colors';

const path = (p: 'RAIDER' | 'SOCIAL'): ApplicationPath => (p === 'SOCIAL' ? 'social' : 'raider');
const status = (s: 'PENDING' | 'ACCEPTED' | 'DECLINED'): AppStatus => s.toLowerCase() as AppStatus;

/** The newest applications as inbox rows, capped so the page cannot grow without bound. */
export const INBOX_LIMIT = 500;

export async function loadInbox(): Promise<InboxItem[]> {
  const rows = await db.application.findMany({
    orderBy: { createdAt: 'desc' },
    take: INBOX_LIMIT,
    select: { id: true, path: true, status: true, character: true, class: true, spec: true, discordName: true, createdAt: true, readAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    path: path(r.path),
    status: status(r.status),
    character: r.character,
    wowClass: (r.class?.toLowerCase() as WowClass | undefined) ?? null,
    spec: r.spec,
    discordName: r.discordName,
    createdAt: r.createdAt.toISOString(),
    unread: r.readAt === null,
  }));
}

/** The message stored with a decision (SYNC-SPEC §4, Decision messages); null on a decision from before messages were stored. */
export type DecisionMessageView = { kind: 'standard' | 'custom' | 'none'; text: string | null; status: 'queued' | 'sent' | 'not-delivered' | 'unconfirmed' | null };

/** The standard messages for this applicant, built by the function a decision uses, from the character name. */
export type StandardMessages = { raider: string; social: string; declined: string };

const MESSAGE_STATUS = { QUEUED: 'queued', SENT: 'sent', NOT_DELIVERED: 'not-delivered', UNCONFIRMED: 'unconfirmed' } as const;

export type ApplicationDetail = InboxItem & {
  /** '' when the applicant was not logged in: there is no account to DM, only the handle. */
  discordId: string;
  logsUrl: string | null;
  answers: unknown;
  decidedAt: string | null;
  decidedBy: string | null;
  discordThreadId: string | null;
  /** True once the application has moved to the social path after submitting (`switchedAt` is set). */
  switched: boolean;
  /** Null when the application never had an interview. */
  interview: InterviewCard | null;
  /** Officer notes and relay messages together, oldest first. */
  notes: NoteEntry[];
  /** Discord name by Discord id, for the people tagged in the notes and messages. */
  mentionUsers: Record<string, string>;
  decisionMessage: DecisionMessageView | null;
  standardMessages: StandardMessages;
};

/** The bot's stored tag names, or null when absent or malformed: the stored JSON is not trusted. */
function storedMentions(raw: unknown): Mentions | null {
  if (raw === null || raw === undefined) return null;
  const r = parseStoredMentions(raw);
  return r.ok ? r.mentions : null;
}

type Sender = { author: string; authorClass: WowClass | null };
export type NoteEntry =
  | (Sender & { kind: 'note'; id: string; body: string; createdAt: string; source: 'web' | 'discord'; discordMessageId: string | null; editedAt: string | null; mentions: Mentions | null })
  | (Sender & {
      kind: 'message';
      id: string;
      body: string;
      createdAt: string;
      direction: 'to' | 'from';
      marker: 'edited' | 'deleted' | 'not-delivered' | 'not-sent' | null;
      attachmentCount: number;
      /** The Discord copy of the message, when it has one. */
      attachmentUrl: string | null;
      mentions: Mentions | null;
    });

type MessageRow = { id: string; direction: 'TO_APPLICANT' | 'FROM_APPLICANT'; authorUserId: string | null; body: string; createdAt: Date; status: 'QUEUED' | 'SENT' | 'NOT_DELIVERED' | 'NOT_SENT' | null; copyChannelId: string | null; copyMessageId: string | null; attachments: unknown; mentions: unknown; editedAt: Date | null; deletedAt: Date | null };

function messageMarker(m: MessageRow): Extract<NoteEntry, { kind: 'message' }>['marker'] {
  if (m.direction === 'FROM_APPLICANT') return m.deletedAt ? 'deleted' : m.editedAt ? 'edited' : null;
  return m.status === 'NOT_DELIVERED' ? 'not-delivered' : m.status === 'NOT_SENT' ? 'not-sent' : null;
}

export async function loadApplication(id: string): Promise<ApplicationDetail | null> {
  const r = await db.application.findUnique({
    where: { id },
    select: {
      id: true,
      path: true,
      status: true,
      character: true,
      class: true,
      spec: true,
      discordId: true,
      discordName: true,
      logsUrl: true,
      answers: true,
      readAt: true,
      createdAt: true,
      decidedAt: true,
      decidedBy: { select: { discordName: true } },
      discordThreadId: true,
      switchedAt: true,
      decisionMessageKind: true,
      decisionMessageText: true,
      decisionMessageStatus: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, direction: true, authorUserId: true, body: true, createdAt: true, status: true, copyChannelId: true, copyMessageId: true, attachments: true, mentions: true, editedAt: true, deletedAt: true },
      },
      notes: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, body: true, createdAt: true, source: true, discordMessageId: true, editedAt: true, mentions: true, author: { select: { discordName: true, characters: { where: { isMain: true }, take: 1, select: { class: true } } } } },
      },
    },
  });
  if (!r) return null;
  const interview = await interviewCard(r.id);
  const officerIds = [...new Set(r.messages.map((m) => m.authorUserId).filter((x): x is string => !!x))];
  const officers = officerIds.length
    ? await db.user.findMany({ where: { id: { in: officerIds } }, select: { id: true, discordName: true, characters: { where: { isMain: true }, take: 1, select: { class: true } } } })
    : [];
  const officerById = new Map(officers.map((o) => [o.id, o]));
  const mentionIds = [...new Set([...r.notes, ...r.messages].flatMap((x) => mentionedUserIds(x.body)))];
  const mentioned = mentionIds.length ? await db.user.findMany({ where: { discordId: { in: mentionIds } }, select: { discordId: true, discordName: true } }) : [];
  const toClass = (c: string | undefined) => (c?.toLowerCase() as WowClass | undefined) ?? null;
  const applicantClass = (r.class?.toLowerCase() as WowClass | undefined) ?? null;
  const noteEntries: NoteEntry[] = r.notes.map((n) => ({
    kind: 'note',
    id: n.id,
    author: n.author.discordName,
    authorClass: toClass(n.author.characters[0]?.class),
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    source: n.source === 'DISCORD' ? 'discord' : 'web',
    discordMessageId: n.discordMessageId,
    editedAt: n.editedAt?.toISOString() ?? null,
    mentions: storedMentions(n.mentions),
  }));
  const messageEntries: NoteEntry[] = r.messages.map((m) => {
    const from = m.direction === 'FROM_APPLICANT';
    const officer = m.authorUserId ? officerById.get(m.authorUserId) : undefined;
    return {
      kind: 'message',
      id: m.id,
      author: from ? r.character : (officer?.discordName ?? 'An officer'),
      authorClass: from ? applicantClass : toClass(officer?.characters[0]?.class),
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      direction: from ? 'from' : 'to',
      marker: messageMarker(m),
      attachmentCount: Array.isArray(m.attachments) ? m.attachments.length : 0,
      // discordThreadUrl builds guild/<path>; channel/message is the path of a message link.
      mentions: storedMentions(m.mentions),
      attachmentUrl: m.copyChannelId && m.copyMessageId ? discordThreadUrl(`${m.copyChannelId}/${m.copyMessageId}`) : null,
    };
  });
  // Array.sort is stable: at the same instant a note stays before a message.
  const notes = [...noteEntries, ...messageEntries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: r.id,
    path: path(r.path),
    status: status(r.status),
    character: r.character,
    wowClass: (r.class?.toLowerCase() as WowClass | undefined) ?? null,
    spec: r.spec,
    discordName: r.discordName,
    discordId: r.discordId,
    logsUrl: r.logsUrl,
    answers: r.answers,
    createdAt: r.createdAt.toISOString(),
    unread: r.readAt === null,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decidedBy: r.decidedBy?.discordName ?? null,
    discordThreadId: r.discordThreadId,
    switched: r.switchedAt !== null,
    interview,
    notes,
    mentionUsers: Object.fromEntries(mentioned.map((u) => [u.discordId, u.discordName])),
    decisionMessage: r.decisionMessageKind ? { kind: r.decisionMessageKind.toLowerCase() as 'standard' | 'custom' | 'none', text: r.decisionMessageText, status: r.decisionMessageStatus ? MESSAGE_STATUS[r.decisionMessageStatus] : null } : null,
    standardMessages: { raider: decisionDm('raider', r.character), social: decisionDm('social', r.character), declined: decisionDm('declined', r.character) },
  };
}

/** Clear the unread dot. Called after the response is sent, so reading never slows the page. */
export async function markRead(id: string): Promise<void> {
  await db.application.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } });
}
