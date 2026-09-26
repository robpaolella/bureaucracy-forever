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
 * upserted with `source: DISCORD`, idempotent on (raid, user); the last write wins.
 * Socials cannot sign up here either. Returns the raid's accepted counts.
 */
export async function POST(request: Request) {
  const read = await readBotRequest(request);
  if ('deny' in read) return read.deny;
  const parsed = parseBotSignup(read.body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { value } = parsed;

  const raid = await db.raid.findFirst({
    where: value.raidId ? { id: value.raidId } : { discordEventId: value.discordEventId! },
    select: { id: true, cancelledAt: true, startsAt: true, durationMin: true },
  });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.cancelledAt) return NextResponse.json({ error: 'This raid was cancelled.' }, { status: 409, headers: NO_STORE });
  if (raid.startsAt.getTime() + raid.durationMin * 60_000 < Date.now()) return NextResponse.json({ error: 'This raid has already happened.' }, { status: 409, headers: NO_STORE });

  // The bot knows the member's Discord roles; a user it has never seen is created as a member.
  const user = await db.user.upsert({
    where: { discordId: value.discordId },
    create: { discordId: value.discordId, discordName: value.discordName, role: 'MEMBER' },
    update: { discordName: value.discordName },
    select: { id: true, role: true },
  });
  if (user.role === 'SOCIAL') return NextResponse.json({ error: 'Social members do not sign up for raids.' }, { status: 403, headers: NO_STORE });

  if (value.response === null) {
    await db.signup.deleteMany({ where: { raidId: raid.id, userId: user.id } });
  } else {
    const fields = { response: RESPONSE_ENUM[value.response], source: 'DISCORD' as const, reason: value.response === 'absent' ? value.reason : null, setByUserId: null };
    await db.signup.upsert({ where: { raidId_userId: { raidId: raid.id, userId: user.id } }, create: { raidId: raid.id, userId: user.id, ...fields }, update: fields });
  }

  const signups = await db.signup.findMany({ where: { raidId: raid.id }, select: { response: true, user: { select: { characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } } } });
  const counts = countAccepted(signups.map((s) => ({ response: s.response.toLowerCase() as RaidResponse, role: (s.user.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null })));
  return NextResponse.json({ raidId: raid.id, userId: user.id, response: value.response, counts }, { headers: NO_STORE });
}
