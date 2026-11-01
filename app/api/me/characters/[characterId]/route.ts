import { editCharacter, removeCharacter } from '@/lib/characters';
import { ownCharacter, resultResponse } from '../shared';

type Params = { params: Promise<{ characterId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { characterId } = await params;
  const v = await ownCharacter(characterId);
  if (v.denied) return v.denied;
  const body: unknown = await request.json().catch(() => null);
  return resultResponse(await editCharacter(v.userId, characterId, body));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { characterId } = await params;
  const v = await ownCharacter(characterId);
  if (v.denied) return v.denied;
  // altOnly refuses any main, a lone one included, inside the transaction.
  return resultResponse(await removeCharacter(v.userId, characterId, { altOnly: true }));
}
