import { db } from '@/lib/db';
import { answerSignup } from '@/lib/character-switch';
import { reply, type Reply } from '@/lib/idempotency';
import { loadRaidView } from '@/lib/raid-view';
import { isRaidResponse, type RaidResponse } from '@/lib/raids';
import { decideBench, decideRespond, type Actor } from '@/lib/signup-rules';
import { userByDiscordId } from '../_lib';

const RESPONSE_ENUM = { accept: 'ACCEPT', tentative: 'TENTATIVE', absent: 'ABSENT' } as const;

/** ACCEPT / TENTATIVE / ABSENT in either case, or the bot's DECLINE alias. */
export function parseResponse(v: unknown): RaidResponse | null {
  const s = String(v ?? '').toLowerCase();
  if (s === 'decline' || s === 'declined') return 'absent';
  return isRaidResponse(s) ? s : null;
}

/**
 * Shared by /respond and /bench (SYNC-SPEC §7): resolve the member, apply the rules,
 * write the sign-up with source DISCORD and the character it brings (answerSignup),
 * queue raid.update if the raid is posted, and
 * answer with the viewer block the bot echoes back ephemerally.
 */
export async function applyDiscordAnswer(raidId: string, discordId: string, action: { kind: 'respond'; response: RaidResponse; reason: string | null; characterId?: string } | { kind: 'bench' }): Promise<Reply> {
  const user = await userByDiscordId(discordId);
  if (!user) return reply(404, { reason: "You're not on the site yet. Log in at the site once with Discord, then try again." });
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { id: true, status: true, locksAt: true, discordThreadId: true, templateId: true } });
  if (!raid) return reply(404, { error: 'No such raid.' });
  const actor: Actor = { role: user.role.toLowerCase() as Actor['role'] };
  const now = new Date();
  // Without a characterId, a first Accept/Tentative brings the member's default (SYNC-SPEC §4).
  const result = await answerSignup({
    raid, userId: user.id, actor,
    characterId: action.kind === 'respond' ? action.characterId ?? null : null,
    notOwned: 'Choose one of your characters for Accept or Tentative.',
    decide: (existing) => action.kind === 'bench' ? decideBench(actor, raid, existing, now) : decideRespond(actor, raid, existing, action.response, now),
    fields: (outcome) => ({ standing: outcome.standing, response: RESPONSE_ENUM[outcome.response], source: 'DISCORD', reason: action.kind === 'respond' && outcome.response === 'absent' ? action.reason : null, setByUserId: null }),
  });
  if (!result.ok) return result.status === 400 ? reply(400, { error: result.reason }) : reply(result.status, { reason: result.reason });
  const removedReserves = result.removed.map(({ kind, itemName, reason }) => ({ kind, itemName, reason }));
  const view = await loadRaidView(raidId, discordId);
  return reply(200, { raidId, viewer: view?.viewer ?? null, counts: view?.counts ?? null, bars: view?.bars ?? null, ...(action.kind === 'respond' ? { removedReserves } : {}) });
}
