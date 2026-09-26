import 'server-only';

import type { ApplicationPath } from '@/components/recruitment/form-state';
import { type AppStatus, type InboxItem } from '@/lib/applications-inbox';
import { db } from '@/lib/db';
import type { WowClass } from '@/lib/design/class-colors';

const path = (p: 'RAIDER' | 'SOCIAL'): ApplicationPath => (p === 'SOCIAL' ? 'social' : 'raider');
const status = (s: 'PENDING' | 'ACCEPTED' | 'DECLINED'): AppStatus => s.toLowerCase() as AppStatus;

/** Every application as an inbox row. Officers only call this; the volume is small. */
export async function loadInbox(): Promise<InboxItem[]> {
  const rows = await db.application.findMany({
    orderBy: { createdAt: 'desc' },
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

export type ApplicationDetail = InboxItem & {
  /** '' when the applicant was not logged in: there is no account to DM, only the handle. */
  discordId: string;
  logsUrl: string | null;
  answers: unknown;
  decidedAt: string | null;
  decidedBy: string | null;
  notes: { id: string; author: string; authorClass: WowClass | null; body: string; createdAt: string }[];
};

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
      decidedBy: { select: { discordName: true, characters: { where: { isMain: true }, take: 1, select: { name: true } } } },
      notes: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, body: true, createdAt: true, author: { select: { discordName: true, characters: { where: { isMain: true }, take: 1, select: { name: true, class: true } } } } },
      },
    },
  });
  if (!r) return null;
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
    decidedBy: r.decidedBy ? r.decidedBy.characters[0]?.name ?? r.decidedBy.discordName : null,
    notes: r.notes.map((n) => ({
      id: n.id,
      author: n.author.characters[0]?.name ?? n.author.discordName,
      authorClass: (n.author.characters[0]?.class.toLowerCase() as WowClass | undefined) ?? null,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

/** Clear the unread dot. Called after the response is sent, so reading never slows the page. */
export async function markRead(id: string): Promise<void> {
  await db.application.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } });
}
