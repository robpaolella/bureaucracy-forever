import { after, NextResponse } from 'next/server';
import { parseDecision } from '@/lib/applications-decide';
import { enqueue } from '@/lib/outbox';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { ensureUser } from '@/lib/users';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * PATCH /api/applications/[id] — an officer's decision (docs/06 § API routes). Body
 * `{ status: "accepted" | "declined" }` records who decided and when; `{ path: "social" }`
 * moves a pending raider application to the social path. A decided application is
 * history and answers 409.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers decide applications.' }, { status: 403, headers: NO_STORE });

  const parsed = parseDecision(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const { id } = await params;
  const app = await db.application.findUnique({ where: { id }, select: { id: true, status: true, path: true, character: true, discordId: true, discordName: true } });
  if (!app) return NextResponse.json({ error: 'No such application.' }, { status: 404, headers: NO_STORE });
  if (app.status !== 'PENDING') return NextResponse.json({ error: 'This application was already decided.' }, { status: 409, headers: NO_STORE });

  if (parsed.value.kind === 'path') {
    if (app.path === 'SOCIAL') return NextResponse.json({ error: 'Already on the social path.' }, { status: 409, headers: NO_STORE });
    // Only a still-pending raider application moves: a decision landing first wins.
    const moved = await db.application.updateMany({ where: { id: app.id, status: 'PENDING', path: 'RAIDER' }, data: { path: 'SOCIAL' } });
    if (moved.count === 0) return NextResponse.json({ error: 'This application was already decided.' }, { status: 409, headers: NO_STORE });
    return NextResponse.json({ id: app.id, path: 'social' }, { headers: NO_STORE });
  }

  const officer = await ensureUser(session);
  // Only a still-pending row is decided: two officers clicking at once cannot both win.
  const decided = await db.application.updateMany({
    where: { id: app.id, status: 'PENDING' },
    data: { status: parsed.value.status === 'accepted' ? 'ACCEPTED' : 'DECLINED', decidedAt: new Date(), decidedByUserId: officer.id, readAt: new Date() },
  });
  if (decided.count === 0) return NextResponse.json({ error: 'This application was already decided.' }, { status: 409, headers: NO_STORE });
  const status = parsed.value.status;
  after(() => enqueue('application.decide', { applicationId: app.id, status, decidedBy: session.name, source: 'web' }));
  return NextResponse.json({ id: app.id, status }, { headers: NO_STORE });
}
