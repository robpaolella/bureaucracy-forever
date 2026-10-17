import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ enabled: true, verify: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/flags', () => ({ helperEnabled: () => mocks.enabled }));
vi.mock('@/lib/helper-keys', () => ({ verifyHelperKey: mocks.verify, recordHelperKeyUse: async () => {} }));
vi.mock('@/lib/addon-batch', () => ({ writeOperationBatch: mocks.write }));

import { POST } from './route';

const AWARD = { type: 'award', id: 'aw-7f3k2m9q', formatVersion: 1, raid: 'cm9xr2k4a0001', env: 'production', boss: 'lb_lucifron', item: 16805, char: 'Ana Vale', method: 'HR', sender: 'Rae Quill', at: 1792001200 };
let n = 0;
const post = (body: string) => POST(new Request('https://example.test/api/helper/operations', {
  method: 'POST', body, headers: { authorization: `Bearer bfh_${'a'.repeat(43)}`, 'x-real-ip': `198.51.100.${n}` },
}));

beforeEach(() => {
  vi.clearAllMocks();
  n += 1;
  mocks.enabled = true;
  mocks.verify.mockResolvedValue({ ok: true, userId: 'u_rae', keyId: `k${n}` });
  mocks.write.mockImplementation(async ({ operations }: { operations: { id: string }[] }) => operations.map((op) => ({ id: op.id, status: 'recorded' })));
});

describe('POST /api/helper/operations', () => {
  it('answers each record in order, written as the key’s officer from this site', async () => {
    const res = await post(JSON.stringify({ operations: [AWARD, { id: 'junk' }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ results: [{ id: 'aw-7f3k2m9q', status: 'recorded' }, { id: 'junk', status: 'rejected', code: 'bad-record' }] });
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ officerId: 'u_rae', env: 'production', via: 'helper' }));
  });

  it.each([['switched off', 503, 'helper-off'], ['a bad key', 401, 'bad-key']] as const)('refuses %s before reading records', async (_case, status, code) => {
    mocks.enabled = status !== 503;
    if (status === 401) mocks.verify.mockResolvedValue({ ok: false, status: 401 });
    const res = await post(JSON.stringify({ operations: [AWARD] }));
    expect([res.status, (await res.json()).code]).toEqual([status, code]);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it.each([['not JSON', '{', 400, 'bad-json'], ['no list', '{"ops":[]}', 400, 'bad-request'], ['101 records', JSON.stringify({ operations: Array(101).fill({}) }), 413, 'too-large']] as const)(
    'refuses a body that is %s, recording nothing', async (_case, body, status, code) => {
      const res = await post(body);
      expect([res.status, (await res.json()).code]).toEqual([status, code]);
      expect(mocks.write).not.toHaveBeenCalled();
    });

  it('answers 500 when a batch fails, so the helper sends it again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.write.mockRejectedValue(new Error('down'));
    const res = await post(JSON.stringify({ operations: [AWARD] }));
    expect([res.status, (await res.json()).code]).toEqual([500, 'server-error']);
  });
});
