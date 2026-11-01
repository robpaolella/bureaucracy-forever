import { describe, expect, it } from 'vitest';
import { rejectsBearer } from './gate';
import { gateDecision, isGatedPath, landingAfterLogin } from './gate';

describe('isGatedPath', () => {
  it('covers both areas including their roots', () => {
    for (const p of ['/members', '/members/', '/members/roster', '/officers', '/officers/applications/abc']) {
      expect(isGatedPath(p)).toBe(true);
    }
  });

  it('leaves public routes alone', () => {
    for (const p of ['/', '/about', '/membership', '/officersclub', '/recruitment', '/login']) {
      expect(isGatedPath(p)).toBe(false);
    }
  });
});

describe('gateDecision', () => {
  it('sends a logged-out visitor to login with a same-origin back path', () => {
    expect(gateDecision('/members/roster', '?tab=all', null)).toEqual({
      kind: 'redirect',
      to: '/login?back=%2Fmembers%2Froster%3Ftab%3Dall',
    });
    expect(gateDecision('/officers', '', null)).toEqual({ kind: 'redirect', to: '/login?back=%2Fofficers' });
  });

  it('gives a member 404 on officer routes, not 403', () => {
    expect(gateDecision('/officers/applications', '', 'member')).toEqual({ kind: 'notFound' });
    expect(gateDecision('/officers', '', 'social')).toEqual({ kind: 'notFound' });
  });

  it('gives socials 404 on every Members page, roster and calendar included', () => {
    for (const path of ['/members', '/members/', '/members/roster', '/members/calendar', '/members/calendar/abc', '/members/calendar/abc/loot', '/members/availability', '/members/availability/anything']) {
      expect(gateDecision(path, '', 'social')).toEqual({ kind: 'notFound' });
    }
  });

  it('still sends the logged-out to login from roster and calendar', () => {
    expect(gateDecision('/members/calendar/abc', '', null)).toEqual({ kind: 'redirect', to: '/login?back=%2Fmembers%2Fcalendar%2Fabc' });
  });

  it('lets members into the whole member area', () => {
    for (const path of ['/members/availability', '/members/roster', '/members/calendar', '/members/calendar/abc']) {
      expect(gateDecision(path, '', 'member')).toEqual({ kind: 'next' });
    }
  });

  it('lets officers everywhere', () => {
    expect(gateDecision('/officers/applications', '', 'officer')).toEqual({ kind: 'next' });
    expect(gateDecision('/members/availability', '', 'officer')).toEqual({ kind: 'next' });
    expect(gateDecision('/members/roster', '', 'officer')).toEqual({ kind: 'next' });
    expect(gateDecision('/members/calendar/abc', '', 'officer')).toEqual({ kind: 'next' });
  });

  it('does not treat look-alike paths as gated sub-areas', () => {
    expect(gateDecision('/members/officers-notes', '', 'member')).toEqual({ kind: 'next' });
    expect(gateDecision('/membership', '', 'social')).toEqual({ kind: 'next' });
  });
});

describe('gateDecision with the loot flag', () => {
  it('404s loot routes for everyone while the flag is off', () => {
    for (const path of ['/officers/loot', '/officers/loot/t1', '/members/loot', '/members/loot/c1']) {
      expect(gateDecision(path, '', 'officer')).toEqual({ kind: 'notFound' });
      expect(gateDecision(path, '', null, { loot: false })).toEqual({ kind: 'notFound' });
    }
  });

  it('gates loot routes like their area once the flag is on', () => {
    expect(gateDecision('/officers/loot', '', 'officer', { loot: true })).toEqual({ kind: 'next' });
    expect(gateDecision('/officers/loot', '', 'member', { loot: true })).toEqual({ kind: 'notFound' });
    for (const path of ['/members/loot', '/members/loot/older']) {
      expect(gateDecision(path, '', 'member', { loot: true })).toEqual({ kind: 'next' });
      expect(gateDecision(path, '', 'officer', { loot: true })).toEqual({ kind: 'next' });
      expect(gateDecision(path, '', 'social', { loot: true })).toEqual({ kind: 'notFound' });
    }
    expect(gateDecision('/members/loot', '', null, { loot: true })).toMatchObject({ kind: 'redirect' });
  });

  it('leaves look-alike paths alone', () => {
    expect(gateDecision('/officers/lootish', '', 'officer')).toEqual({ kind: 'next' });
    expect(gateDecision('/loot', '', 'officer')).toEqual({ kind: 'next' });
  });
});

describe('landingAfterLogin', () => {
  const url = (path: string) => new URL(path, 'https://www.bureauguild.com');

  it('sends a social who set out for a Members page home instead of to a 404', () => {
    expect(landingAfterLogin(url('/members/roster'), 'social')).toBe('/');
    expect(landingAfterLogin(url('/members/calendar/abc?reserves=1'), 'social')).toBe('/');
  });

  it('keeps the back path, query included, where the role may go', () => {
    expect(landingAfterLogin(url('/members/calendar/abc?reserves=1'), 'member')).toBe('/members/calendar/abc?reserves=1');
    expect(landingAfterLogin(url('/officers/raids'), 'officer')).toBe('/officers/raids');
    expect(landingAfterLogin(url('/about'), 'social')).toBe('/about');
  });

  it('never lands back on the login route', () => {
    expect(landingAfterLogin(url('/login?back=%2Fmembers'), 'member')).toBe('/');
  });
});

describe('rejectsBearer', () => {
  it('refuses a bearer header anywhere but the bot and helper routes', () => {
    expect(rejectsBearer('/api/bot/tick', 'Bearer x')).toBe(false);
    expect(rejectsBearer('/api/bot', 'Bearer x')).toBe(false);
    expect(rejectsBearer('/api/raids', 'Bearer x')).toBe(true);
    expect(rejectsBearer('/api/botnet', 'Bearer x')).toBe(true);
    expect(rejectsBearer('/members/roster', 'bearer x')).toBe(true);
    expect(rejectsBearer('/api/raids', null)).toBe(false);
    expect(rejectsBearer('/api/raids', 'Basic x')).toBe(false);
  });

  it('leaves /api/helper to its own guard', () => {
    expect(rejectsBearer('/api/helper/me', 'Bearer bfh_abc')).toBe(false);
    expect(rejectsBearer('/api/helper', 'Bearer bfh_abc')).toBe(false);
    expect(rejectsBearer('/api/helperx', 'Bearer bfh_abc')).toBe(true);
    expect(rejectsBearer('/api/raids', 'Bearer bfh_abc')).toBe(true);
  });
});
