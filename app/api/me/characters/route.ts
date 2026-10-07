import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addAlt } from '@/lib/characters';
import { error, NO_STORE, resultResponse, viewer } from './shared';

export async function GET() {
  const v = await viewer();
  if (v.denied) return v.denied;
  const characters = v.user ? await db.character.findMany({
    where: { userId: v.user.id },
    select: { id: true, name: true, class: true, spec: true, raidRole: true, isMain: true },
    orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
  }) : [];
  return NextResponse.json(characters, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const v = await viewer();
  if (v.denied) return v.denied;
  if (!v.user) return error('Set your main first.', 409);
  const body: unknown = await request.json().catch(() => null);
  return resultResponse(await addAlt(v.user.id, body));
}
