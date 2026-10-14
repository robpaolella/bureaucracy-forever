import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ enabled: true, verify: vi.fn(), record: vi.fn() }));

vi.mock('@/lib/flags', () => ({ helperEnabled: () => mocks.enabled }));
vi.mock('@/lib/helper-keys', () => ({ verifyHelperKey: mocks.verify, recordHelperKeyUse: mocks.record }));

import { guardHelperRequest, HELPER_LIMITS, siteEnv } from './helper-api';

const KEY = `bfh_${'a'.repeat(43)}`;
// The limiter lives in process memory, so each test gets its own address and key id.
let n = 0;
let ip = '';
let keyId = '';
const request = (init: { key?: string | null; body?: string; headers?: Record<string, string> } = {}) =>
  new Request('https://example.test/api/helper/me', {
    method: init.body === undefined ? 'GET' : 'POST',
    body: init.body,
    headers: { 'x-real-ip': ip, ...(init.key === null ? {} : { authorization: `Bearer ${init.key ?? KEY}` }), ...init.headers },
  });
const deny = async (r: Request, options?: { body?: boolean }) => {
  const result = await guardHelperRequest(r, options);
  if (!('deny' in result)) throw new Error('expected a refusal');
  return result.deny;
};

beforeEach(() => {
  vi.clearAllMocks();
  n += 1;
  ip = `203.0.113.${n}`;
  keyId = `k${n}`;
  mocks.enabled = true;
  mocks.verify.mockResolvedValue({ ok: true, userId: 'u1', keyId });
  mocks.record.mockResolvedValue(undefined);
});

describe('guardHelperRequest', () => {
  it('lets a live officer key through and stamps its use', async () => {
    expect(await guardHelperRequest(request())).toEqual({ userId: 'u1', keyId, body: undefined });
    expect(mocks.verify).toHaveBeenCalledWith(KEY);
    expect(mocks.record).toHaveBeenCalledWith(keyId);
  });

  it('refuses everything while the switch is off, before looking at the key', async () => {
    mocks.enabled = false;
    const res = await deny(request());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'The loot helper isn’t switched on for this site.', code: 'not-enabled' });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown or revoked key', { ok: false, status: 401 }, 401, 'bad-key'],
    ['a key whose owner is no longer an officer', { ok: false, status: 403 }, 403, 'not-officer'],
  ])('refuses %s', async (_name, verdict, status, code) => {
    mocks.verify.mockResolvedValue(verdict);
    const res = await deny(request());
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('passes no key on when the header is missing or not a bearer', async () => {
    mocks.verify.mockResolvedValue({ ok: false, status: 401 });
    expect((await deny(request({ key: null }))).status).toBe(401);
    expect(mocks.verify).toHaveBeenLastCalledWith(undefined);
    expect((await deny(request({ key: null, headers: { authorization: `Basic ${KEY}` } }))).status).toBe(401);
    expect(mocks.verify).toHaveBeenLastCalledWith(undefined);
  });

  it('refuses a declared body over 64 KiB before checking the key', async () => {
    const res = await deny(request({ headers: { 'content-length': String(HELPER_LIMITS.bodyBytes + 1) } }));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe('too-large');
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('refuses a body over 64 KiB however it was declared', async () => {
    const r = request({ body: `"${'é'.repeat(HELPER_LIMITS.bodyBytes / 2)}"` });
    // Strip the declared length: the read itself must catch it.
    const res = await deny(new Request(r, { headers: { authorization: `Bearer ${KEY}`, 'x-real-ip': ip } }), { body: true });
    expect(res.status).toBe(413);
  });

  it('reads and parses a JSON body when asked', async () => {
    expect(await guardHelperRequest(request({ body: '{"operations":[]}' }), { body: true })).toMatchObject({ body: { operations: [] } });
    const res = await deny(request({ body: '{nope' }), { body: true });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('bad-json');
  });

  it('allows 30 requests a minute on one key, then 429 with Retry-After', async () => {
    for (let i = 0; i < HELPER_LIMITS.requestsPerKey; i++) expect('deny' in (await guardHelperRequest(request()))).toBe(false);
    const res = await deny(request());
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('rate-limited');
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(Number(res.headers.get('retry-after'))).toBeLessThanOrEqual(60);
  });

  it('answers the eleventh failed authentication in a minute from one address with 429, and blocks that address', async () => {
    mocks.verify.mockResolvedValue({ ok: false, status: 401 });
    for (let i = 0; i < HELPER_LIMITS.failedAuthPerAddress; i++) expect((await deny(request())).status).toBe(401);
    const res = await deny(request());
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/);
    // Even a good key from that address waits out the minute, so guessing can't confirm a hit.
    mocks.verify.mockResolvedValue({ ok: true, userId: 'u1', keyId });
    mocks.verify.mockClear();
    expect((await deny(request())).status).toBe(429);
    expect(mocks.verify).not.toHaveBeenCalled();
    // Another address is unaffected.
    ip = '198.51.100.1';
    expect('deny' in (await guardHelperRequest(request()))).toBe(false);
  });
});

describe('siteEnv', () => {
  it('is staging only on the staging deployment', () => {
    expect(siteEnv({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' })).toBe('staging');
    expect(siteEnv({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' })).toBe('production');
    expect(siteEnv({})).toBe('production');
  });
});
