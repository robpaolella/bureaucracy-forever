import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { memberState, memberUpdate, parseSnapshotMember, rankRoleIdsFromEnv, sweepAllowed, type SnapshotMember } from '@/lib/rank-rules';
import { authorizeBot, NO_STORE } from '../../_lib';

/** Snapshots list every guild member; the body cap in readJson is too small for that. */
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/bot/members/sync — the bot's view of the guild (SYNC-SPEC §3 "Roster derivation").
 * `{ members: [{ discordId, name, avatarUrl, roles }], full }`. Every member gets a row: name,
 * avatar, site role, guild membership and rank from their roles. With `full`, anyone the
 * snapshot does not list has left the server and drops off the roster; a full snapshot with a
 * malformed entry, or one that would drop a quarter of the guild, is refused whole rather
 * than acted on. A member whose web-set rank is still on its way to Discord (an open roles
 * or accept job) keeps it, and a rank is only overwritten if it still reads as it did when
 * the snapshot looked, so an officer's write during the request is not undone.
 */
export async function POST(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_SNAPSHOT_BYTES) return NextResponse.json({ error: 'Snapshot too large.' }, { status: 413, headers: NO_STORE });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_SNAPSHOT_BYTES) return NextResponse.json({ error: 'Snapshot too large.' }, { status: 413, headers: NO_STORE });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400, headers: NO_STORE });
  }
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!Array.isArray(b.members)) return NextResponse.json({ error: 'members must be a list.' }, { status: 400, headers: NO_STORE });
  const full = b.full === true;
  const parsed = b.members.map(parseSnapshotMember);
  const rejected = parsed.filter((m) => m === null).length;
  if (full && rejected > 0) return NextResponse.json({ error: `${rejected} malformed member entries; a full snapshot must be whole.` }, { status: 400, headers: NO_STORE });
  const members = dedupe(parsed.filter((m): m is SnapshotMember => m !== null));
  if (full && members.length === 0) return NextResponse.json({ error: 'A full snapshot with nobody in it is refused.' }, { status: 400, headers: NO_STORE });
  const ids = rankRoleIdsFromEnv();
  const now = new Date();

  // Web writes still travelling to Discord: an open roles job, or an accept whose roles the bot has not applied yet.
  const openJobs = await db.outboxJob.findMany({ where: { type: { in: ['member.roles.sync', 'application.decide'] }, status: { in: ['PENDING', 'RUNNING'] } }, select: { type: true, payload: true } });
  const holding = new Set<string>();
  for (const j of openJobs) {
    const p = j.payload as { discordId?: string; applicantDiscordId?: string | null; status?: string };
    if (j.type === 'member.roles.sync' && p.discordId) holding.add(p.discordId);
    if (j.type === 'application.decide' && p.status === 'accepted' && p.applicantDiscordId) holding.add(p.applicantDiscordId);
  }

  const existing = await db.user.findMany({ where: { discordId: { in: members.map((m) => m.discordId) } }, select: { id: true, discordId: true, rank: true, role: true, inGuild: true, discordName: true, avatarUrl: true, trialStartedAt: true } });
  const byDiscordId = new Map(existing.map((u) => [u.discordId, u]));

  let left = 0;
  if (full) {
    const inGuildNow = await db.user.count({ where: { inGuild: true } });
    const wouldLeave = await db.user.count({ where: { inGuild: true, discordId: { notIn: members.map((m) => m.discordId) } } });
    if (!sweepAllowed(inGuildNow, wouldLeave)) {
      return NextResponse.json({ error: `Refused: this snapshot would drop ${wouldLeave} of ${inGuildNow} members. Is the member cache complete?` }, { status: 409, headers: NO_STORE });
    }
    left = (await db.user.updateMany({ where: { inGuild: true, discordId: { notIn: members.map((m) => m.discordId) } }, data: { inGuild: false, discordSyncedAt: now } })).count;
  }

  const fresh = members.filter((m) => !byDiscordId.has(m.discordId));
  let created = 0;
  if (fresh.length) {
    created = (
      await db.user.createMany({
        data: fresh.map((m) => {
          const state = memberState(m, ids);
          const rank = state.rank ?? 'SOCIAL';
          return { discordId: m.discordId, discordName: m.name, avatarUrl: m.avatarUrl, role: state.role, rank, inGuild: state.inGuild, trialStartedAt: rank === 'TRIAL' ? now : null, discordSyncedAt: now };
        }),
        // The per-member post for a new joiner and the full snapshot can arrive together; the second one loses quietly.
        skipDuplicates: true,
      })
    ).count;
  }

  let updated = 0;
  let rankChanged = 0;
  for (const m of members) {
    const user = byDiscordId.get(m.discordId);
    if (!user) continue;
    const change = memberUpdate(user, m, memberState(m, ids), holding.has(m.discordId), now);
    if (!change) continue;
    // The rank only moves if it still reads as it did a moment ago: a web write since then wins.
    const where = change.rank !== undefined ? { id: user.id, rank: user.rank } : { id: user.id };
    const done = await db.user.updateMany({ where, data: { ...change, discordSyncedAt: now } });
    if (done.count === 0) continue;
    updated += 1;
    if (change.rank !== undefined) {
      await db.character.updateMany({ where: { userId: user.id, isMain: true }, data: { rank: change.rank } });
      rankChanged += 1;
    }
  }
  return NextResponse.json({ created, updated, rankChanged, left, rejected }, { headers: NO_STORE });
}

/** The last entry for an id wins, as the freshest state. */
function dedupe(members: SnapshotMember[]): SnapshotMember[] {
  const seen = new Map<string, SnapshotMember>();
  for (const m of members) seen.set(m.discordId, m);
  return [...seen.values()];
}
