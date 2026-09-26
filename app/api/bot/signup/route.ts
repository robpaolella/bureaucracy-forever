import { NextResponse } from 'next/server';
import { parseBotSignup } from '@/lib/bot-inbound';
import { db } from '@/lib/db';
import type { Role } from '@/lib/design/class-colors';
import { countAccepted, type RaidResponse } from '@/lib/raids';
import { NO_STORE, readBotRequest } from '../_auth';

const RESPONSE_ENUM = { accept: 'ACCEPT', tentative: 'TENTATIVE', absent: 'ABSENT' } as const;

/**
 * POST /api/bot/signup — a sign-up made in Discord (docs/06 § Discord bot sync). Body
 * `{ raidId | discordEventId, discordId, discordName, response, reason? }`; the row is
 * upserted with `source: DISCORD`, idempotent on (raid, user); the later answer wins, judged
 * by the optional `at` (unix seconds) against the stored row. Optional `role` names an
 * unknown member's access level. Socials cannot sign up here either. Returns the raid's
 * accepted counts and whether the answer was ignored as stale.
 */
export async function POST(request: Request) {
  const read = await readBotRequest(request);
  if ('deny' in read) return read.deny;
  const parsed = parseBotSignup(read.body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { value } = parsed;

  // discordEventId has no unique index yet (a migration for later); the newest raid wins a tie.
  const raid = await db.raid.findFirst({
    where: value.raidId ? { id: value.raidId } : { discordEventId: value.discordEventId! },
    orderBy: { startsAt: 'desc' },
    select: { id: true, cancelledAt: true, startsAt: true, durationMin: true },
  });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.cancelledAt) return NextResponse.json({ error: 'This raid was cancelled.' }, { status: 409, headers: NO_STORE });
  if (raid.startsAt.getTime() + raid.durationMin * 60_000 < Date.now()) return NextResponse.json({ error: 'This raid has already happened.' }, { status: 409, headers: NO_STORE });

  // Login owns a known user's role. For a Discord id the site has never seen, the bot
  // must say what the guild roles make them; socials are refused before anything is written.
  const known = await db.user.findUnique({ where: { discordId: value.discordId }, select: { id: true, role: true } });
  if (known?.role === 'SOCIAL' || (!known && value.role === 'social')) {
    return NextResponse.json({ error: 'Social members do not sign up for raids.' }, { status: 403, headers: NO_STORE });
  }
  if (!known && !value.role) return NextResponse.json({ error: 'Unknown member: include their role.' }, { status: 404, headers: NO_STORE });
  const user = known
    ? await db.user.update({ where: { id: known.id }, data: { discordName: value.discordName }, select: { id: true } })
    : await db.user.create({ data: { discordId: value.discordId, discordName: value.discordName, role: value.role === 'officer' ? 'OFFICER' : 'MEMBER' }, select: { id: true } });

  // Conflict rule (docs/06): the later answer wins. The bot sends when the member clicked;
  // an answer older than what is stored (an officer's on-behalf write, a quicker click on
  // the web) is acknowledged but not applied.
  const existing = await db.signup.findUnique({ where: { raidId_userId: { raidId: raid.id, userId: user.id } }, select: { updatedAt: true, response: true } });
  const stale = value.at !== null && existing !== null && existing.updatedAt.getTime() > value.at * 1000;
  if (!stale) {
    if (value.response === null) {
      await db.signup.deleteMany({ where: { raidId: raid.id, userId: user.id } });
    } else {
      const fields = { response: RESPONSE_ENUM[value.response], source: 'DISCORD' as const, reason: value.response === 'absent' ? value.reason : null, setByUserId: null };
      await db.signup.upsert({ where: { raidId_userId: { raidId: raid.id, userId: user.id } }, create: { raidId: raid.id, userId: user.id, ...fields }, update: fields });
    }
  }

  const signups = await db.signup.findMany({ where: { raidId: raid.id }, select: { response: true, user: { select: { characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } } } });
  const counts = countAccepted(signups.map((s) => ({ response: s.response.toLowerCase() as RaidResponse, role: (s.user.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null })));
  const response = stale ? ((existing?.response.toLowerCase() as RaidResponse | undefined) ?? null) : value.response;
  return NextResponse.json({ raidId: raid.id, userId: user.id, response, stale, counts }, { headers: NO_STORE });
}
