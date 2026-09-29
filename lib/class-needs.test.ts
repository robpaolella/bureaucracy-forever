import { describe, expect, it } from 'vitest';
import { SPECS } from '@/lib/design/class-colors';
import { allSpecRows, groupNeeds, homeNeeds, parseFeatureInput, parseNeedInput, rolesOfSpec, type NeedRow } from './class-needs';

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

  it('keeps a star only on a high-need spec', () => {
    const all = allSpecRows([
      { wowClass: 'priest', spec: 'Holy', status: 'high', featured: true },
      { wowClass: 'mage', spec: 'Fire', status: 'medium', featured: true },
    ]);
    expect(all.find((r) => r.wowClass === 'priest' && r.spec === 'Holy')?.featured).toBe(true);
    expect(all.find((r) => r.wowClass === 'mage' && r.spec === 'Fire')?.featured).toBe(false);
  });

  it('validates a feature toggle', () => {
    expect(parseFeatureInput({ wowClass: 'priest', spec: 'Holy', featured: true })).toMatchObject({ ok: true });
    expect(parseFeatureInput({ wowClass: 'priest', spec: 'Holy', featured: 'yes' })).toMatchObject({ ok: false, error: /Featured/ });
    expect(parseFeatureInput({ wowClass: 'priest', spec: 'Fire', featured: true })).toMatchObject({ ok: false, error: /spec/ });
  });
});

describe('homeNeeds', () => {
  const row = (wowClass: NeedRow['wowClass'], spec: string, status: NeedRow['status'], featured = false): NeedRow => ({ wowClass, spec, status, featured });

  it('lists each high-need spec on its own, not every spec of the class', () => {
    const cards = homeNeeds([row('priest', 'Holy', 'high'), row('priest', 'Shadow', 'medium'), row('priest', 'Discipline', 'closed')]);
    expect(cards).toEqual([{ wowClass: 'priest', label: 'Priest', spec: 'Holy', roles: ['healer'], status: 'high', featured: false }]);
  });

  it('caps at four: tanks, healers, melee, ranged, then class order', () => {
    const cards = homeNeeds([
      row('mage', 'Frost', 'high'),
      row('rogue', 'Combat', 'high'),
      row('priest', 'Holy', 'high'),
      row('warrior', 'Protection', 'high'),
      row('shaman', 'Restoration', 'high'),
      row('druid', 'Restoration', 'high'),
    ]);
    expect(cards.map((c) => `${c.wowClass} ${c.spec}`)).toEqual(['warrior Protection', 'priest Holy', 'shaman Restoration', 'druid Restoration']);
  });

  it('puts the starred spec first even when it would be cut', () => {
    const cards = homeNeeds([
      row('warrior', 'Protection', 'high'),
      row('priest', 'Holy', 'high'),
      row('shaman', 'Restoration', 'high'),
      row('druid', 'Restoration', 'high'),
      row('mage', 'Frost', 'high', true),
    ]);
    expect(cards[0]).toMatchObject({ wowClass: 'mage', spec: 'Frost', featured: true });
    expect(cards).toHaveLength(4);
  });

  it('shows medium needs only when nothing is high, and nothing when all is closed', () => {
    expect(homeNeeds([row('mage', 'Fire', 'medium'), row('rogue', 'Combat', 'closed')]).map((c) => c.spec)).toEqual(['Fire']);
    expect(homeNeeds([row('rogue', 'Combat', 'closed')])).toEqual([]);
  });
});
