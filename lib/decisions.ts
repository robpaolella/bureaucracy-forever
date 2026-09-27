import 'server-only';

import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { decisionDm } from '@/content/dm-templates';

export type DecisionStatus = 'accepted' | 'declined';
export type DecisionActor = { userId: string; name: string; source: 'web' | 'discord' };
export type DecisionOutcome = 'decided' | 'conflict' | 'missing';

/**
 * Accept or decline an application from either surface (SYNC-SPEC §4 /decision, §5
 * application.decide). Updates only a still-pending row, so two officers deciding at once
 * cannot both win, and queues the job that posts the decision, DMs the applicant and, on
 * accept, moves their roles.
 */
export async function decideApplication(id: string, status: DecisionStatus, by: DecisionActor, reason: string | null = null): Promise<DecisionOutcome> {
  const app = await db.application.findUnique({ where: { id }, select: { id: true, status: true, path: true, character: true, discordId: true, discordName: true } });
  if (!app) return 'missing';
  if (app.status !== 'PENDING') return 'conflict';
  const now = new Date();
  const decided = await db.application.updateMany({
    where: { id: app.id, status: 'PENDING' },
    data: { status: status === 'accepted' ? 'ACCEPTED' : 'DECLINED', decidedAt: now, decidedByUserId: by.userId, readAt: now },
  });
  if (decided.count === 0) return 'conflict';
  await enqueue('application.decide', {
    applicationId: app.id,
    status,
    path: app.path === 'SOCIAL' ? 'social' : 'raider',
    character: app.character,
    applicantDiscordId: app.discordId || null,
    applicantName: app.discordName,
    decidedBy: by.name,
    source: by.source,
    reason,
    dm: decisionDm(status, app.character),
  });
  return 'decided';
}

/** Reopen a decided application (SYNC-SPEC §4 /reopen). 'conflict' when it is already pending. */
export async function reopenApplication(id: string, by: DecisionActor): Promise<DecisionOutcome> {
  const app = await db.application.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!app) return 'missing';
  if (app.status === 'PENDING') return 'conflict';
  const reopened = await db.application.updateMany({ where: { id: app.id, status: { not: 'PENDING' } }, data: { status: 'PENDING', decidedAt: null, decidedByUserId: null, reopenedAt: new Date(), nudgedAt: null } });
  if (reopened.count === 0) return 'conflict';
  await enqueue('application.reopen', { applicationId: app.id, reopenedBy: by.name, source: by.source });
  return 'decided';
}
