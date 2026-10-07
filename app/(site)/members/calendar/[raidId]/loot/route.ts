import { loadMemberRaidLoot } from '@/lib/member-loot';

export async function GET(_request: Request, { params }: { params: Promise<{ raidId: string }> }) {
  const loot = await loadMemberRaidLoot((await params).raidId);
  return Response.json(loot ?? { error: 'Not found' }, {
    status: loot ? 200 : 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
