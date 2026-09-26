import { NextResponse } from 'next/server';
import { parseBotApplication } from '@/lib/bot-inbound';
import { db } from '@/lib/db';
import { NO_STORE, readBotRequest } from '../_auth';

/**
 * POST /api/bot/application — an application made through the bot's modal, so it lands in
 * the same inbox as the web form (docs/06 § Discord bot sync). One pending application
 * per character, as on the web; a duplicate answers 409 with the existing id.
 */
export async function POST(request: Request) {
  const read = await readBotRequest(request);
  if ('deny' in read) return read.deny;
  const parsed = parseBotApplication(read.body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { value } = parsed;

  const pending = await db.application.findFirst({ where: { status: 'PENDING', character: { equals: value.character, mode: 'insensitive' } }, select: { id: true } });
  if (pending) return NextResponse.json({ error: 'An application for this character is already pending.', id: pending.id }, { status: 409, headers: NO_STORE });

  const created = await db.application.create({
    data: {
      path: value.path === 'social' ? 'SOCIAL' : 'RAIDER',
      discordId: value.discordId,
      discordName: value.discordName,
      character: value.character,
      class: value.wowClass ? (value.wowClass.toUpperCase() as Uppercase<typeof value.wowClass>) : null,
      spec: value.spec,
      logsUrl: value.logsUrl,
      answers: value.answers,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id }, { status: 201, headers: NO_STORE });
}
