import { describe, expect, it } from 'vitest';
import { checkedUrl, childEnvironment, identity, localUrl, assertOwner, OWNER_LABEL } from './local-database';

describe('worker database identity', () => {
  it('is stable, Docker-safe, bounded and distinct for equal folder names in different locations', () => {
    const a = identity('/tmp/one/Worker !');
    expect(a).toEqual(identity('/tmp/one/Worker !'));
    expect(a.name).toMatch(/^bureau-[a-z0-9-]+$/);
    expect(a.name).not.toEqual(identity('/tmp/two/Worker !').name);
    expect(identity(`/tmp/${'a'.repeat(200)}`).name.length).toBeLessThan(64);
  });
  it('requires this exact folder’s ownership label', () => {
    const { owner } = identity('/tmp/worker');
    expect(() => assertOwner({ [OWNER_LABEL]: owner }, owner)).not.toThrow();
    for (const labels of [null, {}, { [OWNER_LABEL]: 'another-folder' }]) {
      expect(() => assertOwner(labels, owner)).toThrow('not created for this folder');
    }
  });
});

describe('local-only connection details', () => {
  it('uses Docker’s allocated port on loopback', () => {
    expect(localUrl('54321')).toBe('postgresql://worker:worker@127.0.0.1:54321/bureau');
    for (const port of ['', '0', '-1', '65536', '123x', '1.5', '12\n34']) expect(() => localUrl(port)).toThrow();
  });
  it('refuses remote hosts and connection redirects', () => {
    for (const url of ['postgresql://example.com/db', 'not-a-url', 'postgresql://localhost/db?host=remote']) {
      expect(() => checkedUrl(url)).toThrow('non-local');
      expect(() => childEnvironment(url, {})).toThrow('non-local');
    }
  });
  it('overrides inherited database and login settings without mutating the parent', () => {
    const inherited = { DATABASE_URL: 'remote', DIRECT_URL: 'remote', AUTH_SECRET: 'real', DISCORD_BOT_TOKEN: 'real', DOTENV_OVERRIDE: 'true', DOTENV_CONFIG_OVERRIDE: 'true', PATH: '/bin' };
    const result = childEnvironment(localUrl('12345'), inherited);
    expect(result.DATABASE_URL).toBe(localUrl('12345'));
    expect(result.DIRECT_URL).toBe(result.DATABASE_URL);
    expect(result.AUTH_SECRET).toHaveLength(64);
    expect(result.DISCORD_BOT_TOKEN).toBe('');
    expect(result.PATH).toBe('/bin');
    expect(result.NODE_ENV).toBe('development');
    expect(result.DOTENV_OVERRIDE).toBe('false');
    expect(result.DOTENV_CONFIG_OVERRIDE).toBe('false');
    expect(inherited.AUTH_SECRET).toBe('real');
  });
});
