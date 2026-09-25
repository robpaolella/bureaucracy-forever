import { describe, expect, it } from 'vitest';
import { CLASS_NEEDS, teaserNeeds, type ClassNeed } from './recruitment';

describe('teaserNeeds', () => {
  it('reproduces the Home.html teaser from the shipped needs', () => {
    expect(teaserNeeds()).toEqual([
      { wowClass: 'priest', label: 'Priest', specs: ['Holy', 'Shadow'], status: 'high' },
      { wowClass: 'warrior', label: 'Warrior', specs: ['Protection'], status: 'high' },
      { wowClass: 'warlock', label: 'Warlock', specs: ['Destruction'], status: 'medium' },
      { wowClass: 'druid', label: 'Druid', specs: ['Restoration'], status: 'medium' },
    ]);
  });

  it('drops closed specs and closed classes entirely', () => {
    const needs: ClassNeed[] = [
      { wowClass: 'mage', spec: 'Frost', role: 'ranged', status: 'closed' },
      { wowClass: 'rogue', spec: 'Combat', role: 'melee', status: 'medium' },
      { wowClass: 'rogue', spec: 'Assassination', role: 'melee', status: 'closed' },
    ];
    expect(teaserNeeds(needs)).toEqual([{ wowClass: 'rogue', label: 'Rogue', specs: ['Combat'], status: 'medium' }]);
  });

  it('shows the most urgent status per class regardless of row order', () => {
    const needs: ClassNeed[] = [
      { wowClass: 'druid', spec: 'Balance', role: 'ranged', status: 'medium' },
      { wowClass: 'druid', spec: 'Restoration', role: 'healer', status: 'high' },
    ];
    expect(teaserNeeds(needs)[0]).toMatchObject({ status: 'high', specs: ['Balance', 'Restoration'] });
  });

  it('orders high before medium and respects the limit', () => {
    const needs: ClassNeed[] = [
      { wowClass: 'mage', spec: 'Fire', role: 'ranged', status: 'medium' },
      { wowClass: 'hunter', spec: 'Marksmanship', role: 'ranged', status: 'high' },
      { wowClass: 'paladin', spec: 'Holy', role: 'healer', status: 'medium' },
    ];
    expect(teaserNeeds(needs, 2).map((c) => c.wowClass)).toEqual(['hunter', 'mage']);
  });

  it('does not mutate the source list', () => {
    const snapshot = JSON.stringify(CLASS_NEEDS);
    teaserNeeds();
    expect(JSON.stringify(CLASS_NEEDS)).toBe(snapshot);
  });
});
