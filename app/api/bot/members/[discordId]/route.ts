import { NextResponse } from 'next/server';
import { authorizeBot, isSnowflake, NO_STORE, userByDiscordId } from '../../_lib';

/** GET /api/bot/members/:discordId — role, rank and main character (SYNC-SPEC §4). 404 if unknown. */
export async function GET(request: Request, { params }: { params: Promise<{ discordId: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const { discordId } = await params;
  if (!isSnowflake(discordId)) return NextResponse.json({ error: 'Not a Discord id.' }, { status: 400, headers: NO_STORE });
  const user = await userByDiscordId(discordId);
  if (!user) return NextResponse.json({ error: 'Unknown member.' }, { status: 404, headers: NO_STORE });
  const main = user.characters[0] ?? null;
  return NextResponse.json(
    {
      discordId,
      discordName: user.discordName,
      role: user.role.toLowerCase(),
      rank: main?.rank.toLowerCase() ?? null,
      main: main ? { name: main.name, class: main.class.toLowerCase(), spec: main.spec, raidRole: main.raidRole.toLowerCase() } : null,
    },
    { headers: NO_STORE },
  );
}
