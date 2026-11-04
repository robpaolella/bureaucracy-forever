import { describe, expect, it } from 'vitest';
import { clientAddress, limitReached, rateLimited, retryAfterSeconds } from './rate-limit';

describe('rateLimited', () => {
  it('allows the limit and rejects the next until the window resets', () => {
    const key = `t-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimited(key, 5, 60_000, t0 + i)).toBe(false);
    expect(rateLimited(key, 5, 60_000, t0 + 10)).toBe(true);
    expect(rateLimited(key, 5, 60_000, t0 + 60_000)).toBe(false);
  });
});

describe('limitReached and retryAfterSeconds', () => {
  it('look at a window without counting', () => {
    const key = `t-${Math.random()}`;
    const t0 = 1_000_000;
    expect(limitReached(key, 2, t0)).toBe(false);
    expect(retryAfterSeconds(key, t0)).toBe(1);
    rateLimited(key, 2, 60_000, t0);
    expect(limitReached(key, 2, t0 + 1)).toBe(false);
    rateLimited(key, 2, 60_000, t0 + 2);
    expect(limitReached(key, 2, t0 + 3)).toBe(true);
    expect(limitReached(key, 2, t0 + 4)).toBe(true);
    expect(retryAfterSeconds(key, t0 + 30_500)).toBe(30);
    expect(limitReached(key, 2, t0 + 60_000)).toBe(false);
  });
});

describe('clientAddress', () => {
  const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
  it('prefers x-real-ip, then the last forwarded hop, never the client-supplied first one', () => {
    expect(clientAddress(headers({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientAddress(headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientAddress(headers({}))).toBe('unknown');
  });
});
