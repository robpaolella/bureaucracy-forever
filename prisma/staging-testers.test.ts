import { describe, expect, it } from 'vitest';
import { buildRoster } from './seed-data';
import { parseStagingTesters } from './staging-testers';

describe('parseStagingTesters', () => {
  it.each([undefined, '', '   '])('treats %s as unset', (value) => {
    expect(parseStagingTesters(value, buildRoster())).toEqual([]);
  });

  it('trims whitespace and builds both coherent main characters', () => {
    const testers = parseStagingTesters(' 111 : officer , 222:member ', buildRoster());
    expect(testers).toEqual([
      {
        discordId: '111', discordName: 'testofficer', role: 'OFFICER', rank: 'OFFICER', inGuild: true,
        characters: { create: { name: 'Testofficer', class: 'WARRIOR', spec: 'Protection', raidRole: 'TANK', rank: 'OFFICER', isMain: true } },
      },
      {
        discordId: '222', discordName: 'testraider', role: 'MEMBER', rank: 'RAIDER', inGuild: true,
        characters: { create: { name: 'Testraider', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED', rank: 'RAIDER', isMain: true } },
      },
    ]);
  });

  it.each([
    ['abc:officer', 'Discord id must contain digits only'],
    ['1.5:member', 'Discord id must contain digits only'],
    [':member', 'Discord id must contain digits only'],
    ['111:admin', 'role must be officer or member'],
    ['111:OFFICER', 'role must be officer or member'],
    ['111', 'use discordId:role'],
    ['111:member:extra', 'use discordId:role'],
    ['111:member,', 'use discordId:role'],
    ['111:officer,111:member', 'duplicate Discord id'],
    [`${buildRoster()[0].discordId}:member`, 'Discord id belongs to a seeded member'],
  ])('refuses %s with a plain message', (value, message) => {
    expect(() => parseStagingTesters(value, buildRoster())).toThrow(message);
  });

  it('keeps all names and ids unique with repeated roles and existing names', () => {
    const roster = [...buildRoster(), { discordId: '999', name: 'TESTOFFICER' }, { discordId: '998', name: 'Testofficer3' }];
    const before = structuredClone(roster);
    const testers = parseStagingTesters('111:officer,222:officer,333:member,444:member', roster);
    expect(testers.map((tester) => tester.characters.create.name)).toEqual(['Testofficer2', 'Testofficer4', 'Testraider', 'Testraider2']);
    const names = [...roster.map((member) => member.name), ...testers.map((tester) => tester.characters.create.name)].map((name) => name.toLowerCase());
    const ids = [...roster, ...testers].map((member) => member.discordId);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(roster).toEqual(before);
    expect(parseStagingTesters('111:officer,222:officer,333:member,444:member', roster)).toEqual(testers);
  });
});
