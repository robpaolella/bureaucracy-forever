import { describe, expect, it } from 'vitest';
import { isHoneypotFilled, parseApplication, submittedSearch } from './applications';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const raider = {
  path: 'raider',
  character: 'redtape',
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
      expect(r.value).toMatchObject({ path: 'raider', character: 'Redtape', discord: 'redtape', wowClass: 'priest', spec: 'Holy', logsUrl: 'https://logs.example.com/r/1' });
      expect(r.value.answers).toEqual({ availability: 'Both nights', pitch: raider.pitch });
    }
  });

  it('takes the name from the session when logged in, however Discord spells it', () => {
    expect(parseApplication(form({ ...raider, discord: '' }), 'Ledgerline')).toMatchObject({ ok: true, value: { discord: 'Ledgerline' } });
    expect(parseApplication(form({ ...raider, discord: '' }), 'Red Tape 📎')).toMatchObject({ ok: true, value: { discord: 'Red Tape 📎' } });
    expect(parseApplication(form({ ...raider, discord: 'red tape' }), null)).toMatchObject({ ok: false, errors: { discord: expect.any(String) } });
  });

  it('names every failing field', () => {
    const r = parseApplication(form({ path: 'raider', character: 'x', discord: '!', class: 'monk', spec: '', logs: 'ftp://x', availability: 'Maybe', pitch: 'short' }), null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['agree', 'availability', 'character', 'class', 'discord', 'logs', 'pitch']);
  });

  it('asks a social for almost nothing', () => {
    const r = parseApplication(form({ path: 'social', character: 'Sidebar', discord: 'sidebar', note: 'Friend of Paperclip.' }), null);
    expect(r).toMatchObject({ ok: true, value: { path: 'social', wowClass: null, spec: null, logsUrl: null, answers: { note: 'Friend of Paperclip.' } } });
  });

  it('spots the honeypot and builds the summary query', () => {
    expect(isHoneypotFilled(form({ website: 'http://spam' }))).toBe(true);
    expect(isHoneypotFilled(form({}))).toBe(false);
    expect(submittedSearch({ path: 'raider', character: 'Redtape', wowClass: 'priest', spec: 'Holy' })).toBe('path=raider&character=Redtape&class=priest&spec=Holy');
    expect(submittedSearch({ path: 'social', character: 'Sidebar', wowClass: null, spec: null })).toBe('path=social&character=Sidebar');
  });
});
