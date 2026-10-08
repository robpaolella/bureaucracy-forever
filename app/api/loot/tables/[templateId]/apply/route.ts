import { NextResponse } from 'next/server';
import { ensureUser } from '@/lib/users';
import { parseIdsFile } from '@/lib/loot-import';
import { itemSourceError } from '@/lib/item-sources';
import { applyLootTable } from '@/lib/loot-load';
import { requireLootOfficer } from '../../../../_loot';
import { jsonBody, NO_STORE } from '../../../../_officer';

/** Body: { file: parsed JSON, source?: 'FOREVER' | 'CLASSIC', token, sourceName: file.name }. */
export async function POST(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE });
  const body = (await jsonBody(request) ?? {}) as { file?: unknown; source?: unknown; token?: unknown; sourceName?: unknown };
  const source = body.source ?? 'FOREVER';
  if (source !== 'FOREVER' && source !== 'CLASSIC') return NextResponse.json({ error: 'Pick Classic or Forever.' }, { status: 400, headers: NO_STORE });
  const policyError = itemSourceError(source);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400, headers: NO_STORE });
  let file;
  try { file = parseIdsFile(body.file); }
  catch (error) {
    return NextResponse.json({ error: `This file isn't a loot list: ${(error as Error).message}` }, { status: 400, headers: NO_STORE });
  }
  if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return NextResponse.json({ error: 'Preview this file before loading it.' }, { status: 400, headers: NO_STORE });
  const sourceName = typeof body.sourceName === 'string' ? body.sourceName.trim() : '';
  if (!sourceName || sourceName.length > 255) return NextResponse.json({ error: 'Give the source file a name under 256 characters.' }, { status: 400, headers: NO_STORE });
  const { templateId } = await params;
  try {
    const officer = await ensureUser(auth.session);
    const result = await applyLootTable({ templateId, file, source, token: body.token, sourceName, officerId: officer.id, officerName: auth.session.name });
    if (!result.ok) return NextResponse.json({ error: result.error, ...('conflicts' in result ? { conflicts: result.conflicts } : {}) }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ added: result.added, newBosses: result.newBosses }, { headers: NO_STORE });
  } catch (error) {
    console.error('loot table apply failed', error);
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500, headers: NO_STORE });
  }
}
