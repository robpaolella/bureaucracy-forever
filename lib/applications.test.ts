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
  wipe: 'Pulled early on Garr, now I wait for the count.',
  agree: 'on',
};

describe('parseApplication', () => {
  it('accepts a raider and normalises the names', () => {
    const r = parseApplication(form(raider), null);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({ path: 'raider', character: 'Redtape', discord: 'redtape', wowClass: 'priest', spec: 'Holy', logsUrl: 'https://logs.example.com/r/1' });
      expect(r.value.answers).toEqual({ availability: 'Both nights', wipe: raider.wipe });
    }
  });

  it('takes the handle from the session when logged in', () => {
    const r = parseApplication(form({ ...raider, discord: '' }), 'Ledgerline');
    expect(r).toMatchObject({ ok: true, value: { discord: 'ledgerline' } });
  });

  it('names every failing field', () => {
    const r = parseApplication(form({ path: 'raider', character: 'x', discord: '!', class: 'monk', spec: '', logs: 'ftp://x', availability: 'Maybe', wipe: 'short' }), null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['agree', 'availability', 'character', 'class', 'discord', 'logs', 'wipe']);
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
