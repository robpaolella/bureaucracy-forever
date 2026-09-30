import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tableItemIds } from '@/lib/loot-data';
import { parseAwardInput, REASONS } from '@/lib/loot-rules';
import { ensureUser } from '@/lib/users';
import { requireLootOfficer } from '../../../_loot';
import { jsonBody, NO_STORE } from '../../../_officer';

/**
 * POST /api/raids/[id]/loot — record who got a drop (officers). Body per parseAwardInput:
 * `{ bossId?, itemId, characterId?, method, roll?, note? }`. The item must be in the raid
 * tier's table; the character and boss names are copied so the record survives edits.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const parsed = parseAwardInput(await jsonBody(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { bossId, itemId, characterId, method, roll, note } = parsed.value;

  const { id: raidId } = await params;
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { cancelledAt: true, templateId: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.cancelledAt) return NextResponse.json({ error: REASONS.cancelled }, { status: 409, headers: NO_STORE });
  const items = raid.templateId ? await tableItemIds(raid.templateId) : new Set<number>();
  if (!items.has(itemId)) return NextResponse.json({ error: REASONS.notInTable }, { status: 409, headers: NO_STORE });

  const [boss, character] = await Promise.all([
    bossId ? db.lootBoss.findFirst({ where: { id: bossId, templateId: raid.templateId! }, select: { name: true } }) : Promise.resolve(null),
    characterId ? db.character.findUnique({ where: { id: characterId }, select: { name: true, userId: true } }) : Promise.resolve(null),
  ]);
  if (bossId && !boss) return NextResponse.json({ error: 'That boss is not in this raid’s loot table.' }, { status: 400, headers: NO_STORE });
  if (characterId && !character) return NextResponse.json({ error: 'No such character.' }, { status: 404, headers: NO_STORE });

  const officer = await ensureUser(auth.session);
  const award = await db.lootAward.create({
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
    },
    select: { id: true },
  });
  return NextResponse.json(award, { status: 201, headers: NO_STORE });
}
