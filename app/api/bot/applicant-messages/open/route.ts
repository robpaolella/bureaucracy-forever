import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authorizeBot, NO_STORE } from '../../_lib';

/**
 * GET /api/bot/applicant-messages/open — one entry per PENDING application, for the bot's DM
 * catch-up (SYNC-SPEC §13). `since` is the later of `createdAt` and `reopenedAt`;
 * `afterDmMessageId` is the latest stored applicant DM's id, or null.
 */
export async function GET(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const apps = await db.application.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, discordId: true, createdAt: true, reopenedAt: true,
      messages: { where: { direction: 'FROM_APPLICANT', dmMessageId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { dmMessageId: true } },
    },
  });
  const open = apps.map((a) => ({
    applicationId: a.id,
    applicantDiscordId: a.discordId,
    since: (a.reopenedAt && a.reopenedAt > a.createdAt ? a.reopenedAt : a.createdAt).toISOString(),
    afterDmMessageId: a.messages[0]?.dmMessageId ?? null,
  }));
  return NextResponse.json({ open }, { headers: NO_STORE });
}
