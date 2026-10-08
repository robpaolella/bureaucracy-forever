import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lockReserveTier } from '@/lib/loot-blocks';
import { parseBossInput } from '@/lib/loot-table-rules';
import { isUniqueViolation, requireLootOfficer } from '../../../../_loot';
import { jsonBody, NO_STORE } from '../../../../_officer';

/** POST /api/loot/tables/[templateId]/bosses — add a boss (or the trash entry) at the end. */
export async function POST(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const parsed = parseBossInput(await jsonBody(request), true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { templateId } = await params;
  const template = await db.raidTemplate.findUnique({ where: { id: templateId }, select: { id: true } });
  if (!template) return NextResponse.json({ error: 'No such raid tier.' }, { status: 404, headers: NO_STORE });

  try {
    const boss = await db.$transaction(async (tx) => {
      await lockReserveTier(tx, templateId);
      const last = await tx.lootBoss.findFirst({ where: { templateId }, orderBy: { position: 'desc' }, select: { position: true } });
      return tx.lootBoss.create({
        data: { templateId, name: parsed.value.name!, isTrash: parsed.value.isTrash ?? false, position: (last?.position ?? -1) + 1 },
        select: { id: true, name: true },
      });
    });
    return NextResponse.json(boss, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: 'This raid already has a boss with that name.' }, { status: 409, headers: NO_STORE });
    throw e;
  }
}
