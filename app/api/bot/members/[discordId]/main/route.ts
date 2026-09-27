import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { withIdempotency, reply } from '@/lib/idempotency';
import { refreshPostedRaidsFor } from '@/lib/roles-sync';
import { parseCharacterInput } from '@/lib/roster-edit';
import { authorizeBot, isSnowflake, NO_STORE, readJson } from '../../../_lib';
import { toPrismaCharacter } from '../../../../roster/fields';

/**
 * PUT /api/bot/members/:discordId/main — `{ firstName, secondName, wowClass, spec, raidRole }`
 * from the "Set my main" flow in Discord (SYNC-SPEC §4, §9.7). Creates or replaces the
 * member's main on the web roster. Rank is not part of it: the member's rank stays what the
 * roles and the officers say. 404 for someone the snapshot has not seen; 409 with a reason
 * when another member already holds that name. Look-up and write share one serializable
 * transaction, so two quick submissions cannot leave a member with two mains.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ discordId: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { discordId } = await params;
  if (!isSnowflake(discordId)) return NextResponse.json({ error: 'Not a Discord id.' }, { status: 400, headers: NO_STORE });
  return withIdempotency(request, async () => {
    const user = await db.user.findUnique({ where: { discordId }, select: { id: true, rank: true } });
    if (!user) return reply(404, { error: 'Unknown member.' });
    // The route's `role` is the raid role; the bot sends it as raidRole. Rank is the member's own.
    const parsed = parseCharacterInput({ ...read.body, role: read.body.raidRole ?? read.body.role, rank: user.rank.toLowerCase() });
    if (!parsed.ok) return reply(400, { error: parsed.error });
    const data = toPrismaCharacter(parsed.value);
    try {
      const outcome = await db.$transaction(
        async (tx) => {
          const clash = await tx.character.findUnique({ where: { name: data.name }, select: { userId: true } });
          if (clash && clash.userId !== user.id) return { taken: true as const };
          const current = await tx.character.findFirst({ where: { userId: user.id, isMain: true }, select: { id: true, raidRole: true } });
          const main = current
            ? await tx.character.update({ where: { id: current.id }, data, select: { name: true, class: true, spec: true, raidRole: true } })
            : await tx.character.create({ data: { userId: user.id, isMain: true, ...data }, select: { name: true, class: true, spec: true, raidRole: true } });
          return { taken: false as const, main, roleChanged: current?.raidRole !== main.raidRole };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (outcome.taken) return reply(409, { reason: `Someone on the roster is already called ${data.name}.` });
      if (outcome.roleChanged) await refreshPostedRaidsFor(user.id);
      const { main } = outcome;
      return reply(200, { discordId, main: { name: main.name, class: main.class.toLowerCase(), spec: main.spec, raidRole: main.raidRole.toLowerCase() }, rank: user.rank.toLowerCase() });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2034')) {
        // The same name, or the same member, written at the same moment: the other write landed first.
        return reply(409, { reason: `Someone on the roster is already called ${data.name}, or your main was just set. Try again.` });
      }
      throw e;
    }
  });
}
