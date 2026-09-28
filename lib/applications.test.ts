import { describe, expect, it } from 'vitest';
import { isHoneypotFilled, parseApplication, submittedSearch } from './applications';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const raider = {
  path: 'raider',
  firstName: 'red',
  secondName: 'TAPE',
  discord: '@RedTape',
  class: 'priest',
  spec: 'Holy',
  logs: 'https://logs.example.com/r/1',
  availability: 'Both nights',
  pitch: 'I read every fight before the night and I never miss a pull.',
  agree: 'on',
};

describe('parseApplication', () => {
  it('accepts a raider and normalises the names', () => {
    const r = parseApplication(form(raider), null);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({ path: 'raider', character: 'Red Tape', discord: 'redtape', wowClass: 'priest', spec: 'Holy', logsUrl: 'https://logs.example.com/r/1' });
      expect(r.value.answers).toEqual({ availability: 'Both nights', pitch: raider.pitch });
    }
  });

  it('takes the name from the session when logged in, however Discord spells it', () => {
    expect(parseApplication(form({ ...raider, discord: '' }), 'Ledgerline')).toMatchObject({ ok: true, value: { discord: 'Ledgerline' } });
    expect(parseApplication(form({ ...raider, discord: '' }), 'Red Tape 📎')).toMatchObject({ ok: true, value: { discord: 'Red Tape 📎' } });
    expect(parseApplication(form({ ...raider, discord: 'red tape' }), null)).toMatchObject({ ok: false, errors: { discord: expect.any(String) } });
  });

  it('names every failing field', () => {
    const r = parseApplication(form({ path: 'raider', firstName: 'x', secondName: 'Toolongsecondname', discord: '!', class: 'monk', spec: '', logs: 'ftp://x', availability: 'Maybe', pitch: 'short' }), null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['agree', 'availability', 'class', 'discord', 'firstName', 'logs', 'pitch', 'secondName']);
  });

  it('asks for both parts of the name, twelve letters each', () => {
    const errorsFor = (firstName: string, secondName: string) => {
      const r = parseApplication(form({ ...raider, firstName, secondName }), null);
      return r.ok ? [] : Object.keys(r.errors);
    };
    expect(errorsFor('Red', '')).toEqual(['secondName']);
    expect(errorsFor('', 'Tape')).toEqual(['firstName']);
    expect(errorsFor('Abcdefghijkl', 'Abcdefghijkl')).toEqual([]);
    expect(errorsFor('Abcdefghijklm', 'Tape')).toEqual(['firstName']);
    expect(errorsFor('Red Tape', 'Tape')).toEqual(['firstName']);
  });

  it('asks a social for almost nothing', () => {
    const r = parseApplication(form({ path: 'social', firstName: 'side', secondName: 'bar', discord: 'sidebar', note: 'Friend of Paperclip.' }), null);
    expect(r).toMatchObject({ ok: true, value: { path: 'social', character: 'Side Bar', wowClass: null, spec: null, logsUrl: null, answers: { note: 'Friend of Paperclip.' } } });
  });

  it('spots the honeypot and builds the summary query', () => {
    expect(isHoneypotFilled(form({ website: 'http://spam' }))).toBe(true);
    expect(isHoneypotFilled(form({}))).toBe(false);
    expect(submittedSearch({ path: 'raider', character: 'Redtape', wowClass: 'priest', spec: 'Holy' })).toBe('path=raider&character=Redtape&class=priest&spec=Holy');
    expect(submittedSearch({ path: 'social', character: 'Sidebar', wowClass: null, spec: null })).toBe('path=social&character=Sidebar');
  });
});
