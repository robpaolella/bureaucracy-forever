import { describe, expect, it } from 'vitest';
import { buildApplications, buildClassNeeds, buildRaids, buildRoster, mondayIndex, officerNames, paintWeek, rng } from './seed-data';

describe('roster', () => {
  const roster = buildRoster();

  it('has 41 members with unique names and Discord ids', () => {
    expect(roster).toHaveLength(41);
    expect(new Set(roster.map((m) => m.name)).size).toBe(41);
    expect(new Set(roster.map((m) => m.discordId)).size).toBe(41);
  });

  it('is a 40-player composition plus one social', () => {
    const count = (r: string) => roster.filter((m) => m.raidRole === r && m.rank !== 'SOCIAL').length;
    expect(count('tank')).toBe(3);
    expect(count('healer')).toBe(10);
    expect(count('melee')).toBe(12);
    expect(count('ranged')).toBe(15);
    expect(roster.filter((m) => m.rank === 'SOCIAL')).toHaveLength(1);
  });

  it('names the About page officers, in order, and keeps rank and role consistent', () => {
    expect(officerNames(roster)).toEqual(['Ledgerline', 'Redtape', 'Subclause']);
    for (const m of roster) {
      if (m.rank === 'OFFICER') expect(m.role).toBe('OFFICER');
      if (m.rank === 'SOCIAL') expect(m.role).toBe('SOCIAL');
      if (m.rank === 'RAIDER' || m.rank === 'TRIAL') expect(m.role).toBe('MEMBER');
    }
  });

  it('is deterministic', () => {
    expect(buildRoster()).toEqual(roster);
  });
});

describe('paintWeek', () => {
  const from = new Date('2026-09-30T12:00:00Z'); // a Wednesday

  it('covers the progression nights in the member’s own local slots', () => {
    // Chicago: Tue/Wed 20:00–23:00 → day 1 and 2, slots 40..45
    const chi = paintWeek('America/Chicago', rng(1), from);
    for (const day of [1, 2]) for (const slot of [40, 41, 42, 43, 44, 45]) expect(chi[`${day}:${slot}`]).toBeDefined();
    // Los Angeles: 18:00–21:00 → slots 36..41
    const la = paintWeek('America/Los_Angeles', rng(1), from);
    for (const slot of [36, 37, 38, 39, 40, 41]) expect(la[`1:${slot}`]).toBeDefined();
    expect(la['1:45']).toBeUndefined();
  });

  it('rolls a European member past midnight into the next day', () => {
    // Berlin: Tue 20:00 Chicago = Wed 03:00 Berlin → day 2, slots 6..11
    const ber = paintWeek('Europe/Berlin', rng(1), from);
    for (const slot of [6, 7, 8, 9, 10, 11]) expect(ber[`2:${slot}`]).toBeDefined();
  });

  it('only uses valid keys and states', () => {
    const week = paintWeek('America/New_York', rng(7), from);
    for (const [key, state] of Object.entries(week)) {
      const [d, s] = key.split(':').map(Number);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(6);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(47);
      expect(['available', 'if-needed']).toContain(state);
    }
  });

  it('maps JS weekdays to Monday-first indices', () => {
    expect(mondayIndex(1)).toBe(0);
    expect(mondayIndex(0)).toBe(6);
    expect(mondayIndex(6)).toBe(5);
  });
});

describe('raids, needs, applications', () => {
  it('schedules three weeks of the raid week in order', () => {
    const raids = buildRaids(new Date('2026-09-30T12:00:00Z'));
    expect(raids).toHaveLength(9);
    for (let i = 1; i < raids.length; i++) expect(raids[i].startsAt.getTime()).toBeGreaterThan(raids[i - 1].startsAt.getTime());
    expect(raids[0].requirements).toEqual({ tank: 2, healer: 8, melee: 11, ranged: 14 });
  });

  it('expands class needs to one row per spec with unique class+spec', () => {
    const rows = buildClassNeeds();
    const keys = rows.map((r) => `${r.wowClass}:${r.spec}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(rows.find((r) => r.wowClass === 'warrior' && r.spec === 'Arms')?.status).toBe('CLOSED');
    expect(rows.find((r) => r.wowClass === 'priest' && r.spec === 'Holy')?.status).toBe('HIGH');
    expect(rows.find((r) => r.wowClass === 'druid' && r.spec === 'Feral')?.roles).toEqual(['tank', 'melee']);
  });

  it('seeds seven pending raider applications for the inbox badge', () => {
    const apps = buildApplications();
    expect(apps.filter((a) => a.status === 'PENDING' && a.path === 'RAIDER')).toHaveLength(7);
    expect(apps.some((a) => a.status === 'ACCEPTED')).toBe(true);
    expect(apps.some((a) => a.status === 'DECLINED')).toBe(true);
  });
});
