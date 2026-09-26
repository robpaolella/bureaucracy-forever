import { describe, expect, it } from 'vitest';
import robots from './robots';
import sitemap, { PUBLIC_PATHS } from './sitemap';

describe('robots and sitemap', () => {
  it('keeps crawlers out of the gated, API and dev routes', () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.allow).toBe('/');
    expect(rule.disallow).toEqual(expect.arrayContaining(['/members/', '/officers/', '/api/', '/dev/']));
  });

  it('lists exactly the public pages on the canonical origin', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual(PUBLIC_PATHS.map((p) => `https://www.bureauguild.com${p}`));
    expect(urls.some((u) => /\/(members|officers|api|dev)\b/.test(u))).toBe(false);
  });
});
