import { describe, expect, it } from 'vitest';
import { stripQuery } from './analytics';

describe('stripQuery', () => {
  it('keeps the path and drops the query string', () => {
    expect(stripQuery({ type: 'pageview', url: 'https://www.bureauguild.com/recruitment/submitted?character=X&class=Y' })).toEqual({
      type: 'pageview',
      url: 'https://www.bureauguild.com/recruitment/submitted',
    });
  });

  it('drops the fragment too', () => {
    expect(stripQuery({ url: 'https://www.bureauguild.com/apply?path=raider#top' }).url).toBe('https://www.bureauguild.com/apply');
  });

  it('leaves an address without a query unchanged', () => {
    expect(stripQuery({ url: 'https://www.bureauguild.com/' }).url).toBe('https://www.bureauguild.com/');
  });

  it('handles a relative address', () => {
    expect(stripQuery({ url: '/officers/applications?id=42' }).url).toBe('/officers/applications');
  });

  it('keeps the other fields of the event', () => {
    expect(stripQuery({ url: 'https://x.test/a?b=1', route: '/a' })).toEqual({ url: 'https://x.test/a', route: '/a' });
  });
});
