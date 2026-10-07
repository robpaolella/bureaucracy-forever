import { loadMemberLootHistory } from '@/lib/member-loot';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const startsAt = query.get('startsAt') ?? '', id = query.get('id') ?? '';
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(startsAt) || !Number.isFinite(Date.parse(startsAt)) || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
    return Response.json({ error: 'Invalid cursor' }, { status: 400, headers });
  }
  const history = await loadMemberLootHistory({ startsAt, id });
  return Response.json(history ?? { error: 'Not found' }, { status: history ? 200 : 404, headers });
}
