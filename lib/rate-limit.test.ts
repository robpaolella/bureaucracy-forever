import { describe, expect, it } from 'vitest';
import { clientAddress, rateLimited } from './rate-limit';

describe('rateLimited', () => {
  it('allows the limit and rejects the next until the window resets', () => {
    const key = `t-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimited(key, 5, 60_000, t0 + i)).toBe(false);
    expect(rateLimited(key, 5, 60_000, t0 + 10)).toBe(true);
    expect(rateLimited(key, 5, 60_000, t0 + 60_000)).toBe(false);
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
