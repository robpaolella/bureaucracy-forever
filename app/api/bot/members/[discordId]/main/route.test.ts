import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ user: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: store.user }, $transaction: store.transaction } }));
vi.mock('@/lib/roles-sync', () => ({ refreshPostedRaidsFor: vi.fn() }));
import { PUT } from './route';

const discordId = '100000000000000001';
const input = { firstName: 'Red', secondName: 'Tape', wowClass: 'mage', spec: 'Frost', raidRole: 'ranged' };

function call(body: object) {
  const request = new Request('https://example.test/api/bot/members/member/main', {
    method: 'PUT',
    headers: { authorization: 'Bearer test-secret' },
    body: JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ discordId }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('BOT_SHARED_SECRET', 'test-secret');
  store.user.mockResolvedValue({ id: 'member', rank: 'RAIDER' });
  store.transaction.mockResolvedValue({ taken: false, main: { name: 'Red Tape', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' }, roleChanged: false });
});

describe('PUT /api/bot/members/:discordId/main', () => {
  it('sets a main with both names', async () => {
    const response = await call(input);
    expect(response.status).toBe(200);
    expect(store.transaction).toHaveBeenCalledTimes(1);
  });

  it.each([{ secondName: '' }, { secondName: '   ' }, { secondName: undefined }])('refuses a blank second name (%o) without writing', async (patch) => {
    const response = await call({ ...input, ...patch });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringMatching(/first and a second name/) });
    expect(store.transaction).not.toHaveBeenCalled();
  });
});
