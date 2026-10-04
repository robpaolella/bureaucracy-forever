import { describe, expect, it } from 'vitest';
import { FOREVER_ONLY, itemSourceError } from './item-sources';

describe('item sources', () => {
  it('allows only Forever on production', () => {
    expect(itemSourceError('CLASSIC', { VERCEL_ENV: 'production' })).toBe(FOREVER_ONLY);
    expect(itemSourceError('FOREVER', { VERCEL_ENV: 'production' })).toBeNull();
  });

  it.each([
    {},
    { NODE_ENV: 'production' },
    { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging', NODE_ENV: 'production' },
    { VERCEL_ENV: 'preview' },
    { VERCEL_ENV: 'development' },
  ])('allows both games outside production: %j', (env) => {
    expect(itemSourceError('CLASSIC', env)).toBeNull();
    expect(itemSourceError('FOREVER', env)).toBeNull();
  });
});
