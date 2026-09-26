import { describe, expect, it } from 'vitest';
import { normaliseName, parseCharacterInput, reconcileCharacter, rolesFor, specsFor } from './roster-edit';

describe('character input', () => {
  const good = { name: 'redtape', wowClass: 'priest', spec: 'Holy', role: 'healer', rank: 'raider' };

  it('normalises the name like the game does', () => {
    expect(normaliseName('rEDTAPE')).toBe('Redtape');
    const r = parseCharacterInput(good);
    expect(r).toMatchObject({ ok: true, value: { name: 'Redtape', wowClass: 'priest', spec: 'Holy', role: 'healer', rank: 'raider' } });
  });

  it('names the field that failed', () => {
    expect(parseCharacterInput({ ...good, name: 'X' })).toMatchObject({ ok: false, error: /2 to 12 letters/ });
    expect(parseCharacterInput({ ...good, name: 'Red tape' })).toMatchObject({ ok: false, error: /letters/ });
    expect(parseCharacterInput({ ...good, wowClass: 'deathknight' })).toMatchObject({ ok: false, error: /class/ });
    expect(parseCharacterInput({ ...good, spec: 'Fire' })).toMatchObject({ ok: false, error: /spec/ });
    expect(parseCharacterInput({ ...good, role: 'tank' })).toMatchObject({ ok: false, error: /raid role/ });
    expect(parseCharacterInput({ ...good, rank: 'gm' })).toMatchObject({ ok: false, error: /rank/ });
  });

  it('knows which roles a spec fills', () => {
    expect(specsFor('druid')).toEqual(['Restoration', 'Feral', 'Balance']);
    expect(rolesFor('druid', 'Feral')).toEqual(['tank', 'melee']);
    expect(rolesFor('mage', 'Holy')).toEqual([]);
  });

  it('keeps spec and role valid when the class changes', () => {
    const r = reconcileCharacter({ name: 'A', wowClass: 'mage', spec: 'Holy', role: 'healer', rank: 'trial' });
    expect(r).toMatchObject({ spec: 'Frost', role: 'ranged' });
    const kept = reconcileCharacter({ name: 'A', wowClass: 'druid', spec: 'Feral', role: 'melee', rank: 'trial' });
    expect(kept.role).toBe('melee');
  });
});
