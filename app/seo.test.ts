import { describe, expect, it } from 'vitest';
import robots from './robots';
import sitemap, { PUBLIC_PATHS } from './sitemap';

describe('robots and sitemap', () => {
  it('keeps crawlers out of the gated, API and dev routes', () => {
    const rules = robots({ VERCEL_ENV: 'production' }).rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.allow).toBe('/');
    expect(rule.disallow).toEqual(expect.arrayContaining(['/members/', '/officers/', '/api/', '/dev/']));
  });

  it('lists exactly the public pages on the canonical origin', () => {
    const urls = sitemap({ VERCEL_ENV: 'production' }).map((e) => e.url);
    expect(urls).toEqual(PUBLIC_PATHS.map((p) => `https://www.bureauguild.com${p}`));
    expect(urls.some((u) => /\/(members|officers|api|dev)\b/.test(u))).toBe(false);
  });

  it('links the live sitemap on production', () => {
    expect(robots({ VERCEL_ENV: 'production' }).sitemap).toBe('https://www.bureauguild.com/sitemap.xml');
  });

  it.each([
    ['staging', { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' }],
    ['another preview', { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/x' }],
    ['a local build', {}],
  ])('keeps %s out of search: no sitemap, pages still crawlable', (_name, env) => {
    const result = robots(env);
    expect(result.sitemap).toBeUndefined();
    const rules = result.rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.allow).toBe('/');
    expect(rule.disallow).toEqual(expect.arrayContaining(['/members/', '/api/']));
    expect(sitemap(env)).toEqual([]);
  });
});
