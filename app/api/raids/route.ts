import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loadRaidCards } from '@/lib/raid-cards';
import { isUpcoming, locksAtFor, parseRaidInput } from '@/lib/raids';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** GET /api/raids — upcoming and in-progress raids as calendar cards (docs/06 § API routes). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  const now = new Date();
  const raids = await loadRaidCards(new Date(now.getTime() - 6 * 3600_000), session.discordId);
  return NextResponse.json({ raids: raids.filter((r) => isUpcoming(r, now)) }, { headers: NO_STORE });
}

/**
 * POST /api/raids — schedule a raid (officers). Body is the form's guild-time wall clock:
 * `{ name, date, time, durationMin, requirements, notes }`; the instant is derived here.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers schedule raids.' }, { status: 403, headers: NO_STORE });

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseRaidInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  if (parsed.startsAt.getTime() < Date.now()) return NextResponse.json({ error: 'That start is already in the past.' }, { status: 400, headers: NO_STORE });

  const { value } = parsed;
  const raid = await db.raid.create({
    data: { name: value.name, startsAt: parsed.startsAt, locksAt: locksAtFor(parsed.startsAt), durationMin: value.durationMin, requirements: value.requirements, notes: value.notes || null },
    select: { id: true, name: true, startsAt: true, durationMin: true, notes: true, cancelledAt: true, discordEventId: true },
  });
  return NextResponse.json({ id: raid.id, name: raid.name, startsAt: raid.startsAt.toISOString() }, { status: 201, headers: NO_STORE });
}
