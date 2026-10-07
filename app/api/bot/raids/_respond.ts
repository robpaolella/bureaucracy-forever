import { db } from '@/lib/db';
import { switchCharacterInTransaction, type RemovedReserve } from '@/lib/character-switch';
import { lockReserveTier } from '@/lib/loot-blocks';
import { characterBrought, MAIN_CHARACTER } from '@/lib/signup-character';

import { reply, type Reply } from '@/lib/idempotency';
import { enqueue } from '@/lib/outbox';
import { loadRaidView } from '@/lib/raid-view';
import { isRaidResponse, type RaidResponse } from '@/lib/raids';
import { decideBench, decideRespond, type Actor, type Existing } from '@/lib/signup-rules';
import { userByDiscordId } from '../_lib';

class SwitchRefusal extends Error {
  constructor(readonly response: Reply) { super('Character switch refused'); }
}

const RESPONSE_ENUM = { accept: 'ACCEPT', tentative: 'TENTATIVE', absent: 'ABSENT' } as const;

/** ACCEPT / TENTATIVE / ABSENT in either case, or the bot's DECLINE alias. */
export function parseResponse(v: unknown): RaidResponse | null {
  const s = String(v ?? '').toLowerCase();
  if (s === 'decline' || s === 'declined') return 'absent';
  return isRaidResponse(s) ? s : null;
}

/**
 * Shared by /respond and /bench (SYNC-SPEC §7): resolve the member, apply the rules,
 * write the sign-up with source DISCORD, queue raid.update if the raid is posted, and
 * answer with the viewer block the bot echoes back ephemerally.
 */
export async function applyDiscordAnswer(raidId: string, discordId: string, action: { kind: 'respond'; response: RaidResponse; reason: string | null; characterId?: string } | { kind: 'bench' }): Promise<Reply> {
  const user = await userByDiscordId(discordId);
  if (!user) return reply(404, { reason: "You're not on the site yet. Log in at the site once with Discord, then try again." });
  const characterId = action.kind === 'respond' ? action.characterId : undefined;
  if (characterId !== undefined && (action.kind !== 'respond' || action.response === 'absent' || !await db.character.findFirst({ where: { id: characterId, userId: user.id }, select: { id: true } }))) {
    return reply(400, { error: 'Choose one of your characters for Accept or Tentative.' });
  }
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { id: true, status: true, locksAt: true, discordThreadId: true, templateId: true } });
  if (!raid) return reply(404, { error: 'No such raid.' });
  const existingRow = await db.signup.findUnique({ where: { raidId_userId: { raidId, userId: user.id } }, select: { standing: true, response: true } });
  const existing: Existing = existingRow ? { standing: existingRow.standing, response: (existingRow.response?.toLowerCase() as RaidResponse | undefined) ?? null } : null;
  const actor: Actor = { role: user.role.toLowerCase() as Actor['role'] };
  const now = new Date();
  const outcome = action.kind === 'bench' ? decideBench(actor, raid, existing, now) : decideRespond(actor, raid, existing, action.response, now);
  if (!outcome.ok) return reply(outcome.status, { reason: outcome.reason });

  const fields = { standing: outcome.standing, response: RESPONSE_ENUM[outcome.response], source: 'DISCORD' as const, reason: action.kind === 'respond' && outcome.response === 'absent' ? action.reason : null, setByUserId: null };
  let removedReserves: Omit<RemovedReserve, 'itemId'>[] = [];
  try {
    await db.$transaction(async (tx) => {
      // Match the switch/reserve lock order before the answer takes a sign-up row lock.
      if (characterId && raid.templateId) await lockReserveTier(tx, raid.templateId);
      const saved = await tx.signup.upsert({ where: { raidId_userId: { raidId, userId: user.id } }, create: { raidId, userId: user.id, characterId: characterId ?? user.characters[0]?.id ?? null, ...fields }, update: fields,
        include: { character: { select: MAIN_CHARACTER.select }, user: { select: { characters: MAIN_CHARACTER } } } });
      if (characterId && characterBrought(saved)?.id !== characterId) {
        const switched = await switchCharacterInTransaction(tx, { raidId, userId: user.id, characterId, actor });
        if (!switched.ok) throw new SwitchRefusal(reply(switched.status, { reason: switched.reason }));
        removedReserves = switched.removed.map(({ kind, itemName, reason }) => ({ kind, itemName, reason }));
      }
      if (raid.discordThreadId) await enqueue('raid.update', { raidId }, tx);
    }, { isolationLevel: 'ReadCommitted' });
  } catch (error) {
    if (error instanceof SwitchRefusal) return error.response;
    throw error;
  }
  const view = await loadRaidView(raidId, discordId);
  return reply(200, { raidId, viewer: view?.viewer ?? null, counts: view?.counts ?? null, bars: view?.bars ?? null, ...(action.kind === 'respond' ? { removedReserves } : {}) });
}
