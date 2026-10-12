import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lockReserveTier } from '@/lib/loot-blocks';
import { tableItemIds } from '@/lib/loot-data';
import { lookupForeverItem, type ForeverLookup } from '@/lib/loot-items';
import { parseAwardInput, REASONS } from '@/lib/loot-rules';
import { SOURCE_CONFLICT } from '@/lib/item-sources';
import { ensureUser } from '@/lib/users';
import { requireLootOfficer } from '../../../_loot';
import { jsonBody, NO_STORE } from '../../../_officer';

const NOT_THIS_TIER = 'That boss is not in this raid’s loot table.';

/** A retry of a saved submission: 200 with the first record, or 409 if the key was another raid's. */
function replay(prior: { id: string; raidId: string }, raidId: string) {
  if (prior.raidId !== raidId) return NextResponse.json({ error: 'That request was already used on another raid.' }, { status: 409, headers: NO_STORE });
  return NextResponse.json({ id: prior.id, replayed: true }, { status: 200, headers: NO_STORE });
}

/**
 * POST /api/raids/[id]/loot — record who got a drop (officers). Body per parseAwardInput:
 * `{ bossId?, itemId, characterId?, method, roll?, note?, requestKey? }`. The item must be in
 * the raid tier's table; the character and boss names are copied so the record survives edits.
 * The winner is not checked against the sign-ups or the reserve rules: the log shows who may
 * roll, but the officer has the last word (a late sub, a trade). Two copies of an item can
 * drop, so the same item to the same member twice is allowed too.
 *
 * An unlisted drop sends `itemRef` (a Wowhead Forever link or id), `bossId` and `requestKey`
 * instead of `itemId`: the item is fetched from Wowhead unless cached, then added to the end of
 * that boss's list (unless already on the tier's table) and recorded, all in one transaction.
 * Failures answer `{ error, code? }` with `code` 'not-forever' | 'not-found' | 'wowhead-down'.
 *
 * Success is 201 `{ id, addedToTable }`. A repeated `requestKey` records nothing and answers
 * 200 `{ id, replayed: true }` with the first record's id.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const parsed = parseAwardInput(await jsonBody(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, ...('code' in parsed ? { code: parsed.code } : {}) }, { status: 400, headers: NO_STORE });
  const { bossId, itemId, characterId, method, roll, note, fromWowhead, requestKey } = parsed.value;

  const { id: raidId } = await params;
  if (requestKey) {
    const prior = await db.lootAward.findUnique({ where: { requestKey }, select: { id: true, raidId: true } });
    if (prior) return replay(prior, raidId);
  }
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { cancelledAt: true, templateId: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.cancelledAt) return NextResponse.json({ error: REASONS.cancelled }, { status: 409, headers: NO_STORE });
  if (!raid.templateId) return NextResponse.json({ error: fromWowhead ? REASONS.noTable : REASONS.notInTable }, { status: 409, headers: NO_STORE });
  const templateId = raid.templateId;
  if (!fromWowhead && !(await tableItemIds(templateId)).has(itemId)) return NextResponse.json({ error: REASONS.notInTable }, { status: 409, headers: NO_STORE });

  const [boss, character] = await Promise.all([
    bossId ? db.lootBoss.findFirst({ where: { id: bossId, templateId }, select: { name: true } }) : Promise.resolve(null),
    characterId ? db.character.findUnique({ where: { id: characterId }, select: { name: true, userId: true } }) : Promise.resolve(null),
  ]);
  if (bossId && !boss) return NextResponse.json({ error: NOT_THIS_TIER }, { status: 400, headers: NO_STORE });
  if (characterId && !character) return NextResponse.json({ error: 'No such character.' }, { status: 404, headers: NO_STORE });

  // Wowhead is asked before the transaction, so no lock is held while it answers.
  let found: ForeverLookup | null = null;
  if (fromWowhead) {
    found = await lookupForeverItem(db, itemId);
    if (!found.ok) return NextResponse.json({ error: found.error, code: found.code }, { status: found.status, headers: NO_STORE });
  }

  const officer = await ensureUser(auth.session);
  // Same lock order as a table load: tier lock first, then the check and insert together, so an
  // item removed in between can't gain an award. Either everything below is saved or nothing.
  const result = await db.$transaction(async (tx) => {
    await lockReserveTier(tx, templateId);
    // Two retries of one submission queue on the tier lock; the second finds the first here.
    if (requestKey) {
      const prior = await tx.lootAward.findUnique({ where: { requestKey }, select: { id: true, raidId: true } });
      if (prior) return { kind: 'replay' as const, prior };
    }
    const onTable = await tx.lootTableEntry.findFirst({ where: { itemId, boss: { templateId } }, select: { itemId: true } });
    let addedToTable = false;
    if (!onTable) {
      if (!found?.ok || !bossId) return { kind: 'refused' as const, reason: REASONS.notInTable };
      if (!await tx.lootBoss.findFirst({ where: { id: bossId, templateId }, select: { id: true } })) return { kind: 'refused' as const, reason: NOT_THIS_TIER };
      if (!found.cached) {
        const { id, name, quality, icon, tooltipHtml } = found.item;
        const data = { name, quality, icon, tooltipHtml, fetchedAt: new Date() };
        // The source predicate keeps a Classic row saved meanwhile from being overwritten.
        const saved = await tx.lootItem.upsert({ where: { id, source: 'FOREVER' }, create: { id, source: 'FOREVER', ...data }, update: data });
        if (!saved) return { kind: 'refused' as const, reason: SOURCE_CONFLICT };
      }
      const last = await tx.lootTableEntry.findFirst({ where: { bossId }, orderBy: { position: 'desc' }, select: { position: true } });
      await tx.lootTableEntry.create({ data: { bossId, itemId, position: (last?.position ?? -1) + 1 } });
      addedToTable = true;
    }
    const award = await tx.lootAward.create({
      data: {
        raidId,
        bossId,
        bossName: boss?.name ?? null,
        itemId,
        characterId,
        characterName: character?.name ?? null,
        userId: character?.userId ?? null,
        method,
        roll,
        note: note || null,
        recordedById: officer.id,
        requestKey,
      },
      select: { id: true },
    });
    return { kind: 'saved' as const, award: { id: award.id, addedToTable } };
  }, { isolationLevel: 'ReadCommitted' });
  if (result.kind === 'replay') return replay(result.prior, raidId);
  if (result.kind === 'refused') return NextResponse.json({ error: result.reason }, { status: 409, headers: NO_STORE });
  return NextResponse.json(result.award, { status: 201, headers: NO_STORE });
}
