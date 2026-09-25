import { describe, expect, it } from 'vitest';
import { gateDecision, isGatedPath } from './gate';

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

  it('lets socials into roster and calendar but not availability (docs/03 § Roles)', () => {
    expect(gateDecision('/members/roster', '', 'social')).toEqual({ kind: 'next' });
    expect(gateDecision('/members/calendar/abc', '', 'social')).toEqual({ kind: 'next' });
    expect(gateDecision('/members/availability', '', 'social')).toEqual({ kind: 'notFound' });
    expect(gateDecision('/members/availability/anything', '', 'social')).toEqual({ kind: 'notFound' });
  });

  it('lets members into the whole member area', () => {
    expect(gateDecision('/members/availability', '', 'member')).toEqual({ kind: 'next' });
    expect(gateDecision('/members/calendar', '', 'member')).toEqual({ kind: 'next' });
  });

  it('lets officers everywhere', () => {
    expect(gateDecision('/officers/applications', '', 'officer')).toEqual({ kind: 'next' });
    expect(gateDecision('/members/availability', '', 'officer')).toEqual({ kind: 'next' });
  });

  it('does not treat look-alike paths as gated sub-areas', () => {
    expect(gateDecision('/members/officers-notes', '', 'member')).toEqual({ kind: 'next' });
    expect(gateDecision('/members/availability-history', '', 'social')).toEqual({ kind: 'next' });
  });
});
