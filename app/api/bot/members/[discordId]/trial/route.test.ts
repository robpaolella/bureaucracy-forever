import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; discordId: string; discordName: string; role: string; rank: string };
const store = vi.hoisted(() => ({ users: [] as Row[], updateMany: vi.fn(), setRank: vi.fn() }));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: async ({ where }: { where: { id?: string; discordId?: string } }) => {
        const u = store.users.find((r) => (where.id ? r.id === where.id : r.discordId === where.discordId));
        return u ? { ...u, characters: [] } : null;
      },
      updateMany: store.updateMany,
    },
  },
}));
vi.mock('@/lib/roles-sync', () => ({ setRankFromWeb: store.setRank }));

import { POST } from './route';

const OFFICER = '100000000000000001';
const RAIDER = '100000000000000002';
const TRIAL = '100000000000000003';
const STRANGER = '100000000000000009';

function call(discordId: string, body: Record<string, unknown>) {
  const request = new Request(`https://example.test/api/bot/members/${discordId}/trial`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ discordId }) });
}

describe('POST /api/bot/members/:discordId/trial', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.users = [
      { id: 'o', discordId: OFFICER, discordName: 'Boss', role: 'OFFICER', rank: 'OFFICER' },
      { id: 'r', discordId: RAIDER, discordName: 'Raidy', role: 'MEMBER', rank: 'RAIDER' },
      { id: 't', discordId: TRIAL, discordName: 'Newbie', role: 'MEMBER', rank: 'TRIAL' },
    ];
    store.updateMany.mockReset().mockResolvedValue({ count: 1 });
    store.setRank.mockReset().mockResolvedValue('changed');
  });

  it('refuses bad ids and bad actions with 400', async () => {
    expect((await call('nope', { action: 'promote', byDiscordId: OFFICER })).status).toBe(400);
    expect((await call(TRIAL, { action: 'promote', byDiscordId: 'x' })).status).toBe(400);
    expect((await call(TRIAL, { action: 'demote', byDiscordId: OFFICER })).status).toBe(400);
    expect((await call(TRIAL, { action: 'extend', days: 8, byDiscordId: OFFICER })).status).toBe(400);
  });

  it('lets only officers answer', async () => {
    for (const by of [RAIDER, STRANGER]) {
      const res = await call(TRIAL, { action: 'promote', byDiscordId: by });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Only officers answer trial check-ins.' });
    }
    expect(store.setRank).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown member and 409 for one who is no longer a trial', async () => {
    expect((await call(STRANGER, { action: 'promote', byDiscordId: OFFICER })).status).toBe(404);
    const res = await call(RAIDER, { action: 'extend', days: 3, byDiscordId: OFFICER });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reason: 'Raidy is not a trial any more (rank: raider).' });
  });

  it('promotes through the roster rank write', async () => {
    const res = await call(TRIAL, { action: 'promote', byDiscordId: OFFICER });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ action: 'promote', rank: 'raider' });
    expect(store.setRank).toHaveBeenCalledWith('t', 'RAIDER');
  });

  it('answers 409 when the rank moved before the promote landed', async () => {
    store.setRank.mockImplementation(async () => {
      store.users[2].rank = 'SOCIAL';
      return 'unchanged';
    });
    const res = await call(TRIAL, { action: 'promote', byDiscordId: OFFICER });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reason: 'Newbie is not a trial any more (rank: social).' });
  });

  it('extends: moves the next check-in and clears the nudge, only while still a trial', async () => {
    const before = Date.now();
    const res = await call(TRIAL, { action: 'extend', days: 3, byDiscordId: OFFICER });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { action: string; rank: string; checkInAt: string };
    expect(body.action).toBe('extend');
    expect(body.rank).toBe('trial');
    const at = Date.parse(body.checkInAt);
    expect(at - before).toBeGreaterThanOrEqual(3 * 86_400_000);
    expect(at - Date.now()).toBeLessThanOrEqual(3 * 86_400_000);
    expect(store.updateMany).toHaveBeenCalledWith({ where: { id: 't', rank: 'TRIAL' }, data: { trialCheckInAt: new Date(body.checkInAt), trialNudgedAt: null } });

    store.updateMany.mockResolvedValue({ count: 0 });
    expect((await call(TRIAL, { action: 'extend', days: 3, byDiscordId: OFFICER })).status).toBe(409);
  });
});
