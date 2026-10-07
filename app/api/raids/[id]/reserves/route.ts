import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { switchCharacterInTransaction, type RemovedReserve } from '@/lib/character-switch';
import { characterBrought, MAIN_CHARACTER } from '@/lib/signup-character';
import { lootEnabled } from '@/lib/flags';
import { hrAwardsFor, loadActiveReserves, loadLootTable, loadReserveTargets, signupAnswer, tableItemIds, type ReserveWindowData } from '@/lib/loot-data';
import { decideReserve, reservesLockAt, reservesLocked } from '@/lib/loot-rules';
import { blockedItemIds, lockReserveTier, winLimits } from '@/lib/loot-blocks';
import { getSession } from '@/lib/session';
import { ensureUser } from '@/lib/users';
import { isUniqueViolation } from '../../../_loot';
import { jsonBody, NO_STORE } from '../../../_officer';

class ReserveRefusal extends Error {
  constructor(readonly status: number, reason: string) { super(reason); }
}

const itemOrNull = (v: unknown): number | null | undefined => (v === null || v === '' || v === undefined ? null : typeof v === 'number' && Number.isSafeInteger(v) ? v : undefined);

/**
 * GET /api/raids/[id]/reserves — what the reserves window needs when it opens away from the raid
 * page (the calendar list): the loot table, everyone's reserves, whose reserves the viewer may set
 * and the lock. A 404 when loot is off, for socials, or when the raid has no table, as the raid page
 * shows no reserves then either.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  const { id: raidId } = await params;
  const raid = lootEnabled() && session.role !== 'social' ? await db.raid.findUnique({ where: { id: raidId }, select: { startsAt: true, cancelledAt: true, templateId: true } }) : null;
  const table = raid?.templateId ? await loadLootTable(raid.templateId) : null;
  if (!raid || !table) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE });
  const [reserves, { targets }] = await Promise.all([loadActiveReserves(raidId), loadReserveTargets(raidId, session.discordId, session.role === 'officer')]);
  const now = new Date();
  return NextResponse.json(
    { table, reserves, targets, lockAt: reservesLockAt(raid.startsAt).toISOString(), locked: reservesLocked(raid.startsAt, now), cancelled: raid.cancelledAt !== null } satisfies ReserveWindowData,
    { headers: NO_STORE },
  );
}

/**
 * PUT /api/raids/[id]/reserves — set (or, with two nulls, clear) a member's hard and soft
 * reserve for this raid. Body `{ characterId, hr, sr, forUserId? }`; `forUserId` is an
 * officer setting someone else's, which also works after the reserve lock
 * (lib/loot-rules.ts decideReserve). The unique indexes on Reserve back the rules up.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!lootEnabled()) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  const officer = session.role === 'officer';

  const body = ((await jsonBody(request)) ?? {}) as Record<string, unknown>;
  const hr = itemOrNull(body.hr);
  const sr = itemOrNull(body.sr);
  const characterId = typeof body.characterId === 'string' ? body.characterId : '';
  if (hr === undefined || sr === undefined || !characterId) return NextResponse.json({ error: 'Pick a character and items.' }, { status: 400, headers: NO_STORE });
  const forUserId = typeof body.forUserId === 'string' && body.forUserId ? body.forUserId : null;
  if (forUserId && !officer) return NextResponse.json({ error: 'Officers only.' }, { status: 403, headers: NO_STORE });

  const { id: raidId } = await params;
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { startsAt: true, cancelledAt: true, templateId: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  const target = forUserId
    ? await db.user.findUnique({ where: { id: forUserId }, select: { id: true, characters: { select: { id: true } } } })
    : await db.user.findUnique({ where: { discordId: session.discordId }, select: { id: true, characters: { select: { id: true } } } });
  if (!target) return NextResponse.json({ error: forUserId ? 'No such member.' : 'Sign up as Accept or Tentative to reserve.' }, { status: forUserId ? 404 : 409, headers: NO_STORE });

  const items = raid.templateId ? await tableItemIds(raid.templateId) : new Set<number>();
  const rows = [
    ...(hr !== null ? [{ kind: 'HR' as const, itemId: hr }] : []),
    ...(sr !== null ? [{ kind: 'SR' as const, itemId: sr }] : []),
  ];
  const setById = forUserId ? (await ensureUser(session)).id : null;
  const data = rows.map((r) => ({ ...r, raidId, userId: target.id, characterId, setById }));
  try {
    const removed = await db.$transaction(async (tx) => {
      if (raid.templateId) await lockReserveTier(tx, raid.templateId);
      const where = { raidId_userId: { raidId, userId: target.id } };
      const brought = await tx.signup.findUnique({ where, include: { character: { select: MAIN_CHARACTER.select }, user: { select: { characters: MAIN_CHARACTER } } } });
      let removed: RemovedReserve[] = [];
      // Clearing picks changes no character; legacy mismatched reserves must remain clearable.
      if (rows.length > 0 && (!brought || characterBrought(brought)?.id !== characterId)) {
        const switched = await switchCharacterInTransaction(tx, { raidId, userId: target.id, characterId, actor: { role: session.role }, officerOverride: officer && !!forUserId && target.id !== setById });
        if (!switched.ok) throw new ReserveRefusal(switched.status, switched.reason);
        removed = switched.removed;
      }
      const signup = await tx.signup.findUnique({ where, select: { response: true } });
      const hrAwards = await hrAwardsFor([characterId], tx);
      const blocked = raid.templateId ? await blockedItemIds(raid.templateId, tx) : new Set<number>();
      const limits = raid.templateId ? await winLimits(raid.templateId, tx) : {};
      const existing = await tx.reserve.findMany({ where: { raidId, userId: target.id } });
      const result = decideReserve(
        { role: session.role },
        { cancelled: raid.cancelledAt !== null, startsAt: raid.startsAt, hasLootTable: items.size > 0 },
        { characterId, hr, sr },
        { response: signupAnswer(signup?.response).response, ownCharacterIds: target.characters.map((c) => c.id), tableItemIds: items, hrAwards, blockedItemIds: blocked, winLimits: limits, existingReserves: existing },
        new Date(),
        officer,
      );
      if (!result.ok) throw new ReserveRefusal(result.status, result.reason);
      // Do not recreate kept rows: preserve their identity, setter and timestamp.
      const kept = existing.filter((r) => blocked.has(r.itemId) && r.characterId === characterId && rows.some((row) => row.kind === r.kind && row.itemId === r.itemId));
      await tx.reserve.deleteMany({ where: { raidId, userId: target.id, ...(kept.length ? { id: { notIn: kept.map((r) => r.id) } } : {}) } });
      await tx.reserve.createMany({ data: data.filter((r) => !kept.some((k) => k.kind === r.kind)) });
      return removed;
    }, { isolationLevel: 'ReadCommitted' });
    return NextResponse.json({ hr, sr, characterId, removed }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ReserveRefusal) return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    // decideReserve already refused the same item twice, so this is two saves racing.
    if (isUniqueViolation(e)) return NextResponse.json({ error: 'Your reserves changed at the same moment. Reload and try again.' }, { status: 409, headers: NO_STORE });
    throw e;
  }
}
