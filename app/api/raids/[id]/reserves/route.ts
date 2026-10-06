import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lootEnabled } from '@/lib/flags';
import { hrAwardsFor, signupAnswer, tableItemIds } from '@/lib/loot-data';
import { decideReserve } from '@/lib/loot-rules';
import { blockedItemIds, lockReserveTier, winLimits } from '@/lib/loot-blocks';
import { getSession } from '@/lib/session';
import { ensureUser } from '@/lib/users';
import { isUniqueViolation } from '../../../_loot';
import { jsonBody, NO_STORE } from '../../../_officer';

const itemOrNull = (v: unknown): number | null | undefined => (v === null || v === '' || v === undefined ? null : typeof v === 'number' && Number.isSafeInteger(v) ? v : undefined);

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

  const [signup, items, hrAwards] = await Promise.all([
    db.signup.findUnique({ where: { raidId_userId: { raidId, userId: target.id } }, select: { response: true } }),
    raid.templateId ? tableItemIds(raid.templateId) : Promise.resolve(new Set<number>()),
    hrAwardsFor([characterId]),
  ]);
  const rows = [
    ...(hr !== null ? [{ kind: 'HR' as const, itemId: hr }] : []),
    ...(sr !== null ? [{ kind: 'SR' as const, itemId: sr }] : []),
  ];
  const setById = forUserId ? (await ensureUser(session)).id : null;
  const data = rows.map((r) => ({ ...r, raidId, userId: target.id, characterId, setById }));
  try {
    const decision = await db.$transaction(async (tx) => {
      if (raid.templateId) await lockReserveTier(tx, raid.templateId);
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
      if (!result.ok) return result;
      // Do not recreate kept rows: preserve their identity, setter and timestamp.
      const kept = existing.filter((r) => blocked.has(r.itemId) && r.characterId === characterId && rows.some((row) => row.kind === r.kind && row.itemId === r.itemId));
      await tx.reserve.deleteMany({ where: { raidId, userId: target.id, ...(kept.length ? { id: { notIn: kept.map((r) => r.id) } } : {}) } });
      await tx.reserve.createMany({ data: data.filter((r) => !kept.some((k) => k.kind === r.kind)) });
      return result;
    }, { isolationLevel: 'ReadCommitted' });
    if (!decision.ok) return NextResponse.json({ error: decision.reason }, { status: decision.status, headers: NO_STORE });
  } catch (e) {
    // decideReserve already refused the same item twice, so this is two saves racing.
    if (isUniqueViolation(e)) return NextResponse.json({ error: 'Your reserves changed at the same moment. Reload and try again.' }, { status: 409, headers: NO_STORE });
    throw e;
  }
  return NextResponse.json({ hr, sr, characterId }, { headers: NO_STORE });
}
