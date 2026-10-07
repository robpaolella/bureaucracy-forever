import { loadMemberLootHistory, type LootHistoryFilters } from '@/lib/member-loot';

const one = (query: URLSearchParams, name: string) => query.getAll(name).length === 1 ? query.get(name) ?? undefined : undefined;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const startsAt = one(query, 'startsAt') ?? '', id = one(query, 'id') ?? '';
  const filters: LootHistoryFilters = { ...(one(query, 'characterId') && { characterId: one(query, 'characterId') }), ...(one(query, 'characterName') && { characterName: one(query, 'characterName') }), ...(one(query, 'templateId') && { templateId: one(query, 'templateId') }) };
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(startsAt) || !Number.isFinite(Date.parse(startsAt)) || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
    return Response.json({ error: 'Invalid cursor' }, { status: 400, headers });
  }
  const history = await loadMemberLootHistory({ startsAt, id }, filters);
  return Response.json(history ?? { error: 'Not found' }, { status: history ? 200 : 404, headers });
}
