import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { jsonBody, NO_STORE, requireOfficer } from '../../../_officer';

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []);

/** POST /api/raids/:id/attendance — `{ attended: [userId], absent: [userId] }` after the raid ends (officers). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const { id } = await params;
  const raid = await db.raid.findUnique({ where: { id }, select: { startsAt: true, durationMin: true, status: true, discordThreadId: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.status === 'CANCELLED') return NextResponse.json({ error: 'This raid was cancelled.' }, { status: 409, headers: NO_STORE });
  if (raid.startsAt.getTime() + raid.durationMin * 60_000 > Date.now()) return NextResponse.json({ error: 'Attendance opens once the raid has ended.' }, { status: 409, headers: NO_STORE });
  const body = (await jsonBody(request)) as Record<string, unknown> | null;
  const attended = [...new Set(ids(body?.attended))];
  // Attended wins if a member is listed in both.
  const absent = [...new Set(ids(body?.absent))].filter((u) => !attended.includes(u));
  const [a, b] = await db.$transaction([
    db.signup.updateMany({ where: { raidId: id, userId: { in: attended } }, data: { attended: true } }),
    db.signup.updateMany({ where: { raidId: id, userId: { in: absent } }, data: { attended: false } }),
  ]);
  // The compact Discord line carries the attended count (SYNC-SPEC §8).
  if (raid.discordThreadId && a.count + b.count > 0) await enqueue('raid.update', { raidId: id });
  return NextResponse.json({ raidId: id, attended: a.count, absent: b.count }, { headers: NO_STORE });
}
