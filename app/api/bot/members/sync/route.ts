import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inGuildFromDiscordRoles, parseSnapshotMember, rankFromDiscordRoles, rankRoleIdsFromEnv } from '@/lib/rank-rules';
import { authorizeBot, NO_STORE } from '../../_lib';

/** Snapshots list every guild member; the body cap in readJson is too small for that. */
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/bot/members/sync — the bot's view of the guild (SYNC-SPEC §3 "Roster derivation").
 * `{ members: [{ discordId, name, avatarUrl, roles }], full }`. Every member gets a row: name,
 * avatar, site role, guild membership and rank from their roles. With `full`, anyone the
 * snapshot does not list has left the server and drops off the roster. A member whose
 * web-set rank is still on its way to Discord (an open member.roles.sync job) keeps it, so
 * the officer's write is not undone by a snapshot taken a second too early.
 */
export async function POST(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const raw = await request.text();
  if (raw.length > MAX_SNAPSHOT_BYTES) return NextResponse.json({ error: 'Snapshot too large.' }, { status: 413, headers: NO_STORE });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400, headers: NO_STORE });
  }
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const members = Array.isArray(b.members) ? b.members.map(parseSnapshotMember).filter((m): m is NonNullable<typeof m> => m !== null) : null;
  if (!members) return NextResponse.json({ error: 'members must be a list.' }, { status: 400, headers: NO_STORE });
  const full = b.full === true;
  if (full && members.length === 0) return NextResponse.json({ error: 'A full snapshot with nobody in it is refused.' }, { status: 400, headers: NO_STORE });
  const ids = rankRoleIdsFromEnv();
  const now = new Date();

  const pendingRoleJobs = await db.outboxJob.findMany({ where: { type: 'member.roles.sync', status: { in: ['PENDING', 'RUNNING'] } }, select: { payload: true } });
  const holding = new Set(pendingRoleJobs.map((j) => String((j.payload as { discordId?: string }).discordId ?? '')));

  let created = 0;
  let updated = 0;
  let rankChanged = 0;
  for (const m of members) {
    const role = m.roles.includes(ids.officer) ? 'OFFICER' : m.roles.includes(ids.member) ? 'MEMBER' : 'SOCIAL';
    const inGuild = inGuildFromDiscordRoles(m.roles, ids);
    const rank = rankFromDiscordRoles(m.roles, ids);
    const existing = await db.user.findUnique({ where: { discordId: m.discordId }, select: { id: true, rank: true, trialStartedAt: true } });
    if (!existing) {
      await db.user.create({ data: { discordId: m.discordId, discordName: m.name, avatarUrl: m.avatarUrl, role, rank, inGuild, trialStartedAt: rank === 'TRIAL' ? now : null, discordSyncedAt: now } });
      created += 1;
      continue;
    }
    const keepRank = holding.has(m.discordId) || existing.rank === rank;
    await db.user.update({
      where: { id: existing.id },
      data: {
        discordName: m.name,
        avatarUrl: m.avatarUrl,
        role,
        inGuild,
        discordSyncedAt: now,
        ...(keepRank ? {} : { rank, trialStartedAt: rank === 'TRIAL' ? existing.trialStartedAt ?? now : null, trialNudgedAt: rank === 'TRIAL' ? undefined : null }),
      },
    });
    if (!keepRank) {
      await db.character.updateMany({ where: { userId: existing.id, isMain: true }, data: { rank } });
      rankChanged += 1;
    }
    updated += 1;
  }

  let left = 0;
  if (full) {
    const gone = await db.user.updateMany({ where: { inGuild: true, discordId: { notIn: members.map((m) => m.discordId) } }, data: { inGuild: false, discordSyncedAt: now } });
    left = gone.count;
  }
  return NextResponse.json({ created, updated, rankChanged, left }, { headers: NO_STORE });
}
