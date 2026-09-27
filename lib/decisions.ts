import 'server-only';

import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { decisionDm } from '@/content/dm-templates';
import { rankRoleIdsFromEnv, roleChangesForAccept } from '@/lib/rank-rules';

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
  const path = app.path === 'SOCIAL' ? 'social' : 'raider';
  let roles: { add: string[]; remove: string[] } | null = null;
  if (status === 'accepted') {
    try {
      roles = roleChangesForAccept(path, rankRoleIdsFromEnv());
    } catch {
      roles = null;
    }
  }
  // Status, the member's roster row and the job land together or not at all.
  const outcome = await db.$transaction(async (tx) => {
    const decided = await tx.application.updateMany({
      where: { id: app.id, status: 'PENDING' },
      data: { status: status === 'accepted' ? 'ACCEPTED' : 'DECLINED', decidedAt: now, decidedByUserId: by.userId, readAt: now },
    });
    if (decided.count === 0) return 'conflict' as const;
    // Accepting puts them on the site's roster at once: a trial for the raider path, social
    // otherwise. The Discord roles travel with the decide job (SYNC-SPEC §5).
    if (status === 'accepted' && app.discordId) {
      const rank = path === 'raider' ? 'TRIAL' : 'SOCIAL';
      await tx.user.upsert({
        where: { discordId: app.discordId },
        create: { discordId: app.discordId, discordName: app.discordName, role: 'MEMBER', rank, inGuild: true, trialStartedAt: rank === 'TRIAL' ? now : null },
        update: { role: 'MEMBER', rank, inGuild: true, trialStartedAt: rank === 'TRIAL' ? now : null, trialNudgedAt: null },
      });
      await tx.character.updateMany({ where: { user: { discordId: app.discordId }, isMain: true }, data: { rank } });
    }
    await enqueue(
      'application.decide',
      {
        applicationId: app.id,
        status,
        path,
        roles,
        character: app.character,
        applicantDiscordId: app.discordId || null,
        applicantName: app.discordName,
        decidedBy: by.name,
        source: by.source,
        reason,
        dm: decisionDm(status, app.character),
      },
      tx,
    );
    return 'decided' as const;
  });
  return outcome;
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
