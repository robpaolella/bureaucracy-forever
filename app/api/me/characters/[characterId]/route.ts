import { db } from '@/lib/db';
import { editCharacter, removeCharacter } from '@/lib/characters';
import { error, resultResponse, viewer } from '../shared';

type Params = { params: Promise<{ characterId: string }> };

async function ownedAlt(characterId: string) {
  const v = await viewer();
  if (v.denied) return { denied: v.denied };
  const character = await db.character.findUnique({ where: { id: characterId }, select: { userId: true, isMain: true } });
  if (!character) return { denied: error('No such character.', 404) };
  if (character.userId !== v.user?.id) return { denied: error('You can only change your own characters.', 403) };
  if (character.isMain) return { denied: error('You can only change your alts here.', 403) };
  return { userId: character.userId };
}

export async function PATCH(request: Request, { params }: Params) {
  const { characterId } = await params;
  const v = await ownedAlt(characterId);
  if (v.denied) return v.denied;
  const body: unknown = await request.json().catch(() => null);
  return resultResponse(await editCharacter(v.userId, characterId, body, { altOnly: true }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { characterId } = await params;
  const v = await ownedAlt(characterId);
  if (v.denied) return v.denied;
  return resultResponse(await removeCharacter(v.userId, characterId, { altOnly: true }));
}
