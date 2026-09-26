import { NextResponse } from 'next/server';
import { isValidTimeZone, isWeek, normalizeWeek } from '@/lib/availability';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

/**
 * The viewer's own availability (docs/06 § API routes). GET returns the painted week or
 * null; PUT replaces the whole week. Members and officers only: socials have no
 * availability (docs/03 § Roles). The proxy already gates the page; this gates the data.
 */

const NO_STORE = { 'Cache-Control': 'private, no-store' };

async function viewer() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE }) };
  if (session.role === 'social') return { error: NextResponse.json({ error: 'Social members do not submit availability.' }, { status: 403, headers: NO_STORE }) };
  return { session };
}

export async function GET() {
  const v = await viewer();
  if ('error' in v) return v.error;
  const row = await db.availability.findFirst({ where: { user: { discordId: v.session.discordId } } });
  return NextResponse.json(row ? { timezone: row.timezone, slots: normalizeWeek(row.slots), updatedAt: row.updatedAt.toISOString() } : null, { headers: NO_STORE });
}

export async function PUT(request: Request) {
  const v = await viewer();
  if ('error' in v) return v.error;
  const { session } = v;

  const body: unknown = await request.json().catch(() => null);
  const timezone = body && typeof body === 'object' ? (body as { timezone?: unknown }).timezone : undefined;
  const slots = body && typeof body === 'object' ? (body as { slots?: unknown }).slots : undefined;
  if (!isValidTimeZone(timezone)) return NextResponse.json({ error: 'timezone must be an IANA zone name.' }, { status: 400, headers: NO_STORE });
  if (!isWeek(slots)) return NextResponse.json({ error: 'slots must map "day:slot" keys to "available" or "if-needed".' }, { status: 400, headers: NO_STORE });

  // JWT sessions do not create a User row; the first write does. Role is copied for the
  // roster's benefit only; access is always decided from the session, never this column.
  const user = await db.user.upsert({
    where: { discordId: session.discordId },
    create: { discordId: session.discordId, discordName: session.name, role: session.role.toUpperCase() as 'MEMBER' | 'OFFICER' },
    update: { discordName: session.name },
    select: { id: true },
  });
  const row = await db.availability.upsert({
    where: { userId: user.id },
    create: { userId: user.id, timezone, slots },
    update: { timezone, slots },
  });
  return NextResponse.json({ timezone: row.timezone, slots: normalizeWeek(row.slots), updatedAt: row.updatedAt.toISOString() }, { headers: NO_STORE });
}
