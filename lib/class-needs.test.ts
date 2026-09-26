import { describe, expect, it } from 'vitest';
import { SPECS } from '@/lib/design/class-colors';
import { allSpecRows, groupNeeds, parseNeedInput, rolesOfSpec, type NeedRow } from './class-needs';

describe('class needs', () => {
  const stored: NeedRow[] = [
    { wowClass: 'warrior', spec: 'Protection', status: 'high' },
    { wowClass: 'warrior', spec: 'Fury', status: 'closed' },
    { wowClass: 'warrior', spec: 'Arms', status: 'closed' },
    { wowClass: 'druid', spec: 'Restoration', status: 'medium' },
    { wowClass: 'druid', spec: 'Feral', status: 'closed' },
    { wowClass: 'mage', spec: 'Frost', status: 'closed' },
  ];

  it('fills every spec, defaulting to closed', () => {
    const all = allSpecRows(stored);
    expect(all).toHaveLength(Object.values(SPECS).reduce((n, specs) => n + specs.length, 0));
    expect(all.find((r) => r.wowClass === 'mage' && r.spec === 'Fire')).toMatchObject({ status: 'closed' });
    expect(all.find((r) => r.wowClass === 'warrior' && r.spec === 'Protection')).toMatchObject({ status: 'high' });
  });

  it('merges specs sharing a status and unions their roles', () => {
    const rows = groupNeeds(stored);
    expect(rows[0]).toEqual({ wowClass: 'warrior', specs: ['Protection'], roles: ['tank'], status: 'high' });
    expect(rows[1]).toEqual({ wowClass: 'warrior', specs: ['Fury', 'Arms'], roles: ['melee'], status: 'closed' });
    expect(rows[2]).toMatchObject({ wowClass: 'druid', specs: ['Restoration'], status: 'medium' });
    expect(rows[3]).toEqual({ wowClass: 'druid', specs: ['Feral'], roles: ['tank', 'melee'], status: 'closed' });
    expect(rows[4]).toMatchObject({ wowClass: 'mage', status: 'closed' });
  });

  it('knows which roles a spec fills', () => {
    expect(rolesOfSpec('druid', 'Feral')).toEqual(['tank', 'melee']);
    expect(rolesOfSpec('mage', 'Holy')).toEqual([]);
  });

  it('validates an officer write', () => {
    expect(parseNeedInput({ wowClass: 'priest', spec: 'Holy', status: 'high' })).toMatchObject({ ok: true });
    expect(parseNeedInput({ wowClass: 'priest', spec: 'Fire', status: 'high' })).toMatchObject({ ok: false, error: /spec/ });
    expect(parseNeedInput({ wowClass: 'priest', spec: 'Holy', status: 'urgent' })).toMatchObject({ ok: false, error: /Status/ });
    expect(parseNeedInput({ wowClass: 'monk', spec: 'Holy', status: 'high' })).toMatchObject({ ok: false, error: /class/ });
  });
});
