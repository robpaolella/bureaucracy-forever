import { describe, expect, it } from 'vitest';
import { isActive, MEMBER_LINKS, OFFICER_LINKS, PUBLIC_LINKS } from './nav';

describe('isActive', () => {
  it('matches the exact path', () => {
    expect(isActive('/about', '/about')).toBe(true);
    expect(isActive('/about', '/schedule')).toBe(false);
  });

  it('matches nested routes but not prefixes', () => {
    expect(isActive('/members/calendar/abc', '/members/calendar')).toBe(true);
    expect(isActive('/members/calendar-archive', '/members/calendar')).toBe(false);
  });

  it('never marks an action link with a query or hash as current', () => {
    expect(isActive('/members/calendar', '/members/calendar?new=1')).toBe(false);
    expect(isActive('/recruitment', OFFICER_LINKS.needs.href)).toBe(false);
    expect(isActive('/members/calendar', MEMBER_LINKS.calendar.href)).toBe(true);
  });

  it('does not light up home for every route', () => {
    expect(isActive('/about', '/')).toBe(false);
    expect(isActive('/', '/')).toBe(true);
  });

  it('keeps the four public links in the documented order', () => {
    expect(PUBLIC_LINKS.map((l) => l.href)).toEqual(['/about', '/schedule', '/recruitment', '/loot']);
    expect(PUBLIC_LINKS.map((l) => l.label)).toEqual(['About', 'Raiding', 'Recruitment', 'Loot rules']);
  });

  it('places Loot history after Raid calendar in the shared member links', () => {
    expect(Object.values(MEMBER_LINKS).map((l) => l.label)).toEqual(['My availability', 'Roster', 'Raid calendar', 'Loot history']);
    expect(MEMBER_LINKS.loot.href).toBe('/members/loot');
  });

  it('labels the officer links in menu order', () => {
    expect(Object.values(OFFICER_LINKS).map((l) => l.label)).toEqual([
      'Applications',
      'Availability',
      'Roster management',
      'Raid management',
      'Recruitment management',
      'Loot tables',
    ]);
  });
});
