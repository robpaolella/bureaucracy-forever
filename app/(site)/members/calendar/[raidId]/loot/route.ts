import { loadMemberRaidLoot } from '@/lib/loot-data';

/** Never cache signed-in loot, including denied or cancelled responses. */
export async function GET(_request: Request, { params }: { params: Promise<{ raidId: string }> }) {
  const { raidId } = await params;
  const loot = await loadMemberRaidLoot(raidId);
  return Response.json(loot, { status: loot ? 200 : 404, headers: { 'Cache-Control': 'private, no-store' } });
}
