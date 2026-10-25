import 'server-only';

import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { closeActiveInterview } from '@/lib/interviews';
import { decisionDm } from '@/content/dm-templates';
import { rankRoleIdsFromEnv, roleChangesForAccept } from '@/lib/rank-rules';
import type { AcceptAs, DecisionChoice } from '@/lib/applications-decide';

export type DecisionStatus = 'accepted' | 'declined';
export type DecisionActor = { userId: string; name: string; source: 'web' | 'discord' };
/** 'moved': Accept as raider on an application moved to the social path in the meantime. */
export type DecisionOutcome = 'decided' | 'conflict' | 'missing' | 'moved';

/** The 409 reason for 'moved' (SYNC-SPEC §4, Decision request). */
export const MOVED_TO_SOCIAL = 'This application was moved to the social path in the meantime. Check it and decide again.';

const SELECT = { id: true, status: true, path: true, character: true, discordId: true, discordName: true, switchedAt: true } as const;

/**
 * Accept or decline an application from either surface (SYNC-SPEC §4 /decision and Decision
 * request, §5 application.decide). Updates only a row still pending and on the path that was
 * read, so two officers deciding at once cannot both win and a move to social in between is
 * noticed: the site re-reads once and decides again on the new path, or refuses. Queues the
 * job that posts the decision, sends the chosen message and, on accept, moves their roles.
 * Accept as social on a raider-path application switches it first. An active interview
 * closes with it.
 */
export async function decideApplication(id: string, status: DecisionStatus, by: DecisionActor, reason: string | null = null, choice: DecisionChoice = {}): Promise<DecisionOutcome> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const app = await db.application.findUnique({ where: { id }, select: SELECT });
    if (!app) return 'missing';
    if (app.status !== 'PENDING') return 'conflict';
    const read = app.path === 'SOCIAL' ? 'social' : 'raider';
    if (status === 'accepted' && choice.acceptAs === 'raider' && read === 'social') return 'moved';
    const outcome = await decideOnPath(app, read, status, by, reason, choice);
    if (outcome !== 'path_changed') return outcome;
  }
  return 'conflict';
}

async function decideOnPath(
  app: { id: string; path: 'RAIDER' | 'SOCIAL'; character: string; discordId: string; discordName: string; switchedAt: Date | null },
  read: AcceptAs,
  status: DecisionStatus,
  by: DecisionActor,
  reason: string | null,
  choice: DecisionChoice,
): Promise<DecisionOutcome | 'path_changed'> {
  const now = new Date();
  const path: AcceptAs = status === 'accepted' ? choice.acceptAs ?? read : read;
  const switching = path === 'social' && read === 'raider';
  const switchedAt = app.switchedAt ?? (switching ? now : null);
  let roles: { add: string[]; remove: string[] } | null = null;
  if (status === 'accepted') {
    try {
      roles = roleChangesForAccept(path, rankRoleIdsFromEnv());
    } catch {
      roles = null;
    }
  }
  const message = status === 'accepted' ? { kind: 'standard' as const } : choice.message ?? { kind: 'standard' as const };
  const text = message.kind === 'custom' ? message.text : message.kind === 'none' ? null : decisionDm(status === 'accepted' ? path : 'declined', app.character);
  const decisionId = randomUUID();
  // Status, the switch, the message, the member's roster row and the job land together or not at all.
  return db.$transaction(async (tx) => {
    const decided = await tx.application.updateMany({
      where: { id: app.id, status: 'PENDING', path: app.path },
      data: {
        status: status === 'accepted' ? 'ACCEPTED' : 'DECLINED',
        decidedAt: now,
        decidedByUserId: by.userId,
        readAt: now,
        ...(switching ? { path: 'SOCIAL' as const, switchedAt } : {}),
        decisionMessageKind: message.kind === 'custom' ? 'CUSTOM' : message.kind === 'none' ? 'NONE' : 'STANDARD',
        decisionMessageText: text,
        decisionMessageStatus: text === null ? null : 'QUEUED',
        decisionId,
      },
    });
    if (decided.count === 0) return 'path_changed' as const;
    // Accepting puts them on the site's roster at once: a trial for the raider path, social
    // otherwise. The Discord roles travel with the decide job (SYNC-SPEC §5).
    if (status === 'accepted' && app.discordId) {
      const rank = path === 'raider' ? 'TRIAL' : 'SOCIAL';
      await tx.user.upsert({
        where: { discordId: app.discordId },
        create: { discordId: app.discordId, discordName: app.discordName, role: 'MEMBER', rank, inGuild: true, trialStartedAt: rank === 'TRIAL' ? now : null },
        update: { role: 'MEMBER', rank, inGuild: true, trialStartedAt: rank === 'TRIAL' ? now : null, trialNudgedAt: null, trialCheckInAt: null },
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
        // `dm` stays for a bot from before decision messages: null sends nothing (SYNC-SPEC §5, Deploy order).
        dm: text,
        decisionId,
        message: { kind: message.kind, text },
        switched: switchedAt !== null,
      },
      tx,
    );
    // Deciding ends any interview still in progress (SYNC-SPEC §12).
    await closeActiveInterview(app.id, by.userId, now, tx);
    return 'decided' as const;
  });
}

/** Reopen a decided application (SYNC-SPEC §4 /reopen). Clears the decision message and its id; `switchedAt` stays. 'conflict' when it is already pending. */
export async function reopenApplication(id: string, by: DecisionActor): Promise<DecisionOutcome> {
  const app = await db.application.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!app) return 'missing';
  if (app.status === 'PENDING') return 'conflict';
  const reopened = await db.application.updateMany({ where: { id: app.id, status: { not: 'PENDING' } }, data: { status: 'PENDING', decidedAt: null, decidedByUserId: null, reopenedAt: new Date(), decisionMessageKind: null, decisionMessageText: null, decisionMessageStatus: null, decisionId: null } });
  if (reopened.count === 0) return 'conflict';
  await enqueue('application.reopen', { applicationId: app.id, reopenedBy: by.name, source: by.source });
  return 'decided';
}
