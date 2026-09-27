import { describe, expect, it } from 'vitest';
import { bearerToken, verifyBearer } from './bot-auth';

describe('bearer auth', () => {
  it('accepts the shared secret and nothing else', () => {
    expect(verifyBearer('Bearer s3cret', 's3cret')).toEqual({ ok: true });
    expect(verifyBearer('bearer s3cret', 's3cret')).toEqual({ ok: true });
    expect(verifyBearer('Bearer other', 's3cret')).toMatchObject({ ok: false, status: 401 });
    expect(verifyBearer('Bearer s3cret1', 's3cret')).toMatchObject({ ok: false, status: 401 });
    expect(verifyBearer(null, 's3cret')).toMatchObject({ ok: false, status: 401 });
    expect(verifyBearer('Basic abc', 's3cret')).toMatchObject({ ok: false, status: 401 });
    expect(verifyBearer('Bearer s3cret', undefined)).toMatchObject({ ok: false, status: 503 });
  });

  it('extracts the token', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken('')).toBeNull();
  });
});
