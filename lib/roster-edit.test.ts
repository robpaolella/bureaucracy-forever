import { describe, expect, it } from 'vitest';
import { fullName, normaliseName, parseCharacterInput, reconcileCharacter, rolesFor, specsFor, splitName } from './roster-edit';

describe('character input', () => {
  const good = { name: 'redtape', wowClass: 'priest', spec: 'Holy', role: 'healer', rank: 'raider' };

  it('normalises the name like the game does', () => {
    expect(normaliseName('rEDTAPE')).toBe('Redtape');
    const r = parseCharacterInput(good);
    expect(r).toMatchObject({ ok: true, value: { name: 'Redtape', wowClass: 'priest', spec: 'Holy', role: 'healer', rank: 'raider' } });
  });

  it('names the field that failed', () => {
    expect(parseCharacterInput({ ...good, name: 'X' })).toMatchObject({ ok: false, error: /2 to 12 letters/ });
    expect(parseCharacterInput({ ...good, name: 'Red tape' })).toMatchObject({ ok: true, value: { name: 'Red Tape' } });
    expect(parseCharacterInput({ ...good, name: 'Red tape extra' })).toMatchObject({ ok: false, error: /letters/ });
    expect(parseCharacterInput({ ...good, name: 'Red t' })).toMatchObject({ ok: false, error: /letters/ });
    expect(parseCharacterInput({ ...good, name: 'A÷b' })).toMatchObject({ ok: false, error: /letters/ });
    expect(parseCharacterInput({ ...good, name: 'Ångström' })).toMatchObject({ ok: true });
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

describe('two-part names', () => {
  it('joins and normalises first and second names, and accepts one part alone', () => {
    expect(fullName('red', 'TAPE')).toBe('Red Tape');
    expect(fullName(' Red ', '')).toBe('Red');
    expect(fullName('R', 'Tape')).toBeNull();
    expect(fullName('Red', '  ')).toBe('Red');
    expect(fullName('ÿves', '')).toBeNull(); // capitalised Ÿ leaves the letter block
    expect(fullName('ßabcdefghijk', '')).toBeNull(); // SS makes it thirteen letters
    expect(fullName('A\u030angstrom', '')).toBe('Ångstrom'); // decomposed input is composed first
    expect(splitName('')).toEqual({ first: '', second: '' });
    expect(fullName('Red', 'Tapeisfartoolong')).toBeNull();
    expect(splitName('Red Tape')).toEqual({ first: 'Red', second: 'Tape' });
    expect(splitName('Redtape')).toEqual({ first: 'Redtape', second: '' });
  });

  it('parses the two parts when the form sends them', () => {
    const good = { firstName: 'red', secondName: 'tape', wowClass: 'priest', spec: 'Holy', role: 'healer', rank: 'raider' };
    expect(parseCharacterInput(good)).toMatchObject({ ok: true, value: { name: 'Red Tape' } });
    expect(parseCharacterInput({ ...good, secondName: 'x' })).toMatchObject({ ok: false });
    expect(parseCharacterInput({ ...good, name: 'Other Name' })).toMatchObject({ ok: true, value: { name: 'Red Tape' } }); // the parts win
    expect(parseCharacterInput({ ...good, firstName: undefined, secondName: undefined, name: 'Red  Tape' })).toMatchObject({ ok: true, value: { name: 'Red Tape' } });
  });
});
