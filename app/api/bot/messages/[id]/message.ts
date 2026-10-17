import 'server-only';

import { SITE_URL } from '@/lib/config';
import { db } from '@/lib/db';
import { relayPing } from '@/lib/relay';

/**
 * A relay message with what the bot needs to render it, including the `ping` rule (SYNC-SPEC
 * §13): the `GET /messages/:id` shape, also the `{ message }` of a send. Null if unknown.
 */
export async function readMessage(id: string): Promise<Record<string, unknown> | null> {
  const m = await db.applicantMessage.findUnique({
    where: { id },
    include: { application: { select: { id: true, status: true, discordId: true, character: true, discordThreadId: true, relayPingAt: true } } },
  });
  if (!m) return null;
  const app = m.application;
  const [author, lastSent] = await Promise.all([
    m.authorUserId ? db.user.findUnique({ where: { id: m.authorUserId }, select: { discordId: true, discordName: true } }) : null,
    m.direction === 'FROM_APPLICANT' && !m.copyMessageId
      ? db.applicantMessage.findFirst({ where: { applicationId: app.id, direction: 'TO_APPLICANT', authorUserId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { authorUserId: true } })
      : null,
  ]);
  const officer = lastSent?.authorUserId ? await db.user.findUnique({ where: { id: lastSent.authorUserId }, select: { discordId: true, role: true } }) : null;
  return {
    id: m.id,
    direction: m.direction,
    status: m.status,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    attachments: m.attachments,
    dmChannelId: m.dmChannelId,
    dmMessageId: m.dmMessageId,
    copyChannelId: m.copyChannelId,
    copyMessageId: m.copyMessageId,
    author: m.direction === 'TO_APPLICANT' && author ? { discordId: author.discordId, name: author.discordName } : null,
    applicant: { discordId: app.discordId, characterName: app.character },
    application: { id: app.id, status: app.status, threadId: app.discordThreadId },
    pageUrl: `${SITE_URL}/officers/applications/${app.id}`,
    ping: relayPing({ direction: m.direction, copyMessageId: m.copyMessageId, relayPingAt: app.relayPingAt, lastOfficer: officer }),
  };
}
