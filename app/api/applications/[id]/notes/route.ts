import { NextResponse } from 'next/server';
import { parseNote } from '@/lib/applications-decide';
import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { getSession } from '@/lib/session';
import { ensureUser } from '@/lib/users';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** POST /api/applications/[id]/notes — a private officer note (docs/06 § API routes; never shown to applicants). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers write notes.' }, { status: 403, headers: NO_STORE });

  const parsed = parseNote(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const { id } = await params;
  const app = await db.application.findUnique({ where: { id }, select: { id: true } });
  if (!app) return NextResponse.json({ error: 'No such application.' }, { status: 404, headers: NO_STORE });

  const author = await ensureUser(session);
  const note = await db.$transaction(async (tx) => {
    const created = await tx.officerNote.create({ data: { applicationId: app.id, authorId: author.id, body: parsed.body, source: 'WEB' }, select: { id: true, createdAt: true } });
    // Mirrored into the #applications thread as "**Name** (web) · body" (SYNC-SPEC §5).
    await enqueue('application.note.post', { applicationId: app.id, noteId: created.id, author: session.name, body: parsed.body }, tx);
    return created;
  });
  return NextResponse.json({ id: note.id, createdAt: note.createdAt.toISOString() }, { status: 201, headers: NO_STORE });
}
