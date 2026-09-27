import { db } from '@/lib/db';
import { withIdempotency, reply } from '@/lib/idempotency';
import { parseCharacterInput } from '@/lib/roster-edit';
import { authorizeBot, isSnowflake, readJson } from '../../../_lib';
import { toPrismaCharacter } from '../../../../roster/fields';

/**
 * PUT /api/bot/members/:discordId/main — `{ firstName, secondName, wowClass, spec, raidRole }`
 * from the "Set my main" flow in Discord (SYNC-SPEC §4, §9.7). Creates or replaces the
 * member's main on the web roster. Rank is not part of it: the member's rank stays what the
 * roles and the officers say. 404 for someone the snapshot has not seen; 409 when another
 * member already holds that name.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ discordId: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { discordId } = await params;
  if (!isSnowflake(discordId)) return reply(400, { error: 'Not a Discord id.' });
  return withIdempotency(request, async () => {
    const user = await db.user.findUnique({ where: { discordId }, select: { id: true, rank: true, characters: { where: { isMain: true }, take: 1, select: { id: true } } } });
    if (!user) return reply(404, { error: 'Unknown member.' });
    // The route's `role` is the raid role; the bot sends it as raidRole. Rank is the member's own.
    const parsed = parseCharacterInput({ ...read.body, role: read.body.raidRole ?? read.body.role, rank: user.rank.toLowerCase() });
    if (!parsed.ok) return reply(400, { error: parsed.error });
    const data = toPrismaCharacter(parsed.value);
    const clash = await db.character.findUnique({ where: { name: data.name }, select: { userId: true } });
    if (clash && clash.userId !== user.id) return reply(409, { reason: `Someone on the roster is already called ${data.name}.` });
    const main = user.characters[0]
      ? await db.character.update({ where: { id: user.characters[0].id }, data, select: { name: true, class: true, spec: true, raidRole: true } })
      : await db.character.create({ data: { userId: user.id, isMain: true, ...data }, select: { name: true, class: true, spec: true, raidRole: true } });
    return reply(200, { discordId, main: { name: main.name, class: main.class.toLowerCase(), spec: main.spec, raidRole: main.raidRole.toLowerCase() }, rank: user.rank.toLowerCase() });
  });
}
