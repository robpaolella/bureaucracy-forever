import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ role: 'officer' as string | null, enabled: true, apply: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.role ? { role: mocks.role, discordId: 'discord-officer', name: 'Sample Officer' } : null }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.enabled }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'officer' }) }));
vi.mock('@/lib/loot-load', () => ({ applyLootTable: mocks.apply }));
import { POST } from './route';
const body = { file: { bosses: [{ name: 'Boss', items: [1] }] }, sourceName: 'table.json', token: 'a'.repeat(64) };
const call = (input: unknown = body) => POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify(input) }), { params: Promise.resolve({ templateId: 'tier' }) });
beforeEach(() => {
  mocks.role = 'officer'; mocks.enabled = true;
  mocks.apply.mockReset().mockResolvedValue({ ok: true, added: 1, newBosses: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe('loot-table apply route', () => {
  it.each([null, 'member', 'social'])('404s for %s without applying', async (role) => {
    mocks.role = role;
    expect((await call()).status).toBe(404);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('404s with loot disabled', async () => {
    mocks.enabled = false;
    expect((await call()).status).toBe(404);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('uses the parser error and rejects invalid metadata/source before applying', async () => {
    const response = await call({ ...body, file: {} });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'This file isn\'t a loot list: it needs a non-empty "bosses" list.' });
    for (const extra of [{ token: 'bad' }, { sourceName: '' }, { sourceName: 'x'.repeat(256) }, { source: 'other' }]) expect((await call({ ...body, ...extra })).status).toBe(400);
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await call({ ...body, source: 'CLASSIC' })).status).toBe(400);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('passes the validated file and session identity, returning counts without caching', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ added: 1, newBosses: 1 });
    expect(mocks.apply).toHaveBeenCalledWith({ templateId: 'tier', file: { bosses: [{ name: 'Boss', isTrash: false, itemIds: [1] }], skipped: [] }, source: 'FOREVER', token: body.token, sourceName: 'table.json', officerId: 'officer', officerName: 'Sample Officer' });
  });
  it.each([
    [409, 'The table changed since this preview.'],
    [404, 'No such raid tier.'],
  ])('returns %s domain errors', async (status, error) => {
    mocks.apply.mockResolvedValue({ ok: false, status, error });
    const response = await call();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });
  it('returns a normal zero result for no additions and a safe error for a database failure', async () => {
    mocks.apply.mockResolvedValue({ ok: true, added: 0, newBosses: 0 });
    expect(await (await call()).json()).toEqual({ added: 0, newBosses: 0 });
    mocks.apply.mockRejectedValue(new Error('database detail'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await call();
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Couldn't save that." });
    } finally { log.mockRestore(); }
  });
});
