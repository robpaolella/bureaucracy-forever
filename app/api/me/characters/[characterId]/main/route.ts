import { changeMain } from '@/lib/characters';
import { ownCharacter, resultResponse } from '../../shared';

type Params = { params: Promise<{ characterId: string }> };

/** POST /api/me/characters/[characterId]/main — a Guild Member makes one of their characters the main. */
export async function POST(_request: Request, { params }: Params) {
  const { characterId } = await params;
  const v = await ownCharacter(characterId);
  if (v.denied) return v.denied;
  // Characters never change owner, so the check above still holds inside changeMain.
  return resultResponse(await changeMain(characterId));
}
