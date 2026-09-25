import { describe, expect, it } from 'vitest';
import { CLASS_NEEDS, teaserNeeds, type ClassNeed } from './recruitment';

describe('teaserNeeds', () => {
  it('derives the home teaser from the needs table: high first, in table order', () => {
    expect(teaserNeeds()).toEqual([
      { wowClass: 'warrior', label: 'Warrior', specs: ['Protection'], status: 'high' },
      { wowClass: 'priest', label: 'Priest', specs: ['Holy', 'Discipline', 'Shadow'], status: 'high' },
      { wowClass: 'shaman', label: 'Shaman', specs: ['Restoration', 'Elemental'], status: 'high' },
      { wowClass: 'druid', label: 'Druid', specs: ['Restoration'], status: 'medium' },
    ]);
  });

  it('drops closed specs and closed classes entirely', () => {
    const needs: ClassNeed[] = [
      { wowClass: 'mage', specs: ['Frost'], roles: ['ranged'], status: 'closed' },
      { wowClass: 'rogue', specs: ['Combat'], roles: ['melee'], status: 'medium' },
      { wowClass: 'rogue', specs: ['Assassination'], roles: ['melee'], status: 'closed' },
    ];
    expect(teaserNeeds(needs)).toEqual([{ wowClass: 'rogue', label: 'Rogue', specs: ['Combat'], status: 'medium' }]);
  });

  it('shows the most urgent status per class regardless of row order', () => {
    const needs: ClassNeed[] = [
      { wowClass: 'druid', specs: ['Balance'], roles: ['ranged'], status: 'medium' },
      { wowClass: 'druid', specs: ['Restoration'], roles: ['healer'], status: 'high' },
    ];
    expect(teaserNeeds(needs)[0]).toMatchObject({ status: 'high', specs: ['Balance', 'Restoration'] });
  });

  it('orders high before medium and respects the limit', () => {
    const needs: ClassNeed[] = [
      { wowClass: 'mage', specs: ['Fire'], roles: ['ranged'], status: 'medium' },
      { wowClass: 'hunter', specs: ['Marksmanship'], roles: ['ranged'], status: 'high' },
      { wowClass: 'paladin', specs: ['Holy'], roles: ['healer'], status: 'medium' },
    ];
    expect(teaserNeeds(needs, 2).map((c) => c.wowClass)).toEqual(['hunter', 'mage']);
  });

  it('does not mutate the source list', () => {
    const snapshot = JSON.stringify(CLASS_NEEDS);
    teaserNeeds();
    expect(JSON.stringify(CLASS_NEEDS)).toBe(snapshot);
  });
});
