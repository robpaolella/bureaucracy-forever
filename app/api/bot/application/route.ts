import { NextResponse } from 'next/server';
import { parseBotApplication } from '@/lib/bot-inbound';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
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

  // Check and insert in one serializable transaction, as the web form does, so a modal
  // double-submit or a bot retry cannot leave two pending rows for one character.
  try {
    const outcome = await db.$transaction(
      async (tx) => {
        const pending = await tx.application.findFirst({ where: { status: 'PENDING', character: { equals: value.character, mode: 'insensitive' } }, select: { id: true } });
        if (pending) return { duplicate: pending.id };
        const created = await tx.application.create({
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
        return { created: created.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if ('duplicate' in outcome) return NextResponse.json({ error: 'An application for this character is already pending.', id: outcome.duplicate }, { status: 409, headers: NO_STORE });
    return NextResponse.json({ id: outcome.created }, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
      return NextResponse.json({ error: 'An application for this character is already pending.' }, { status: 409, headers: NO_STORE });
    }
    throw e;
  }
}
