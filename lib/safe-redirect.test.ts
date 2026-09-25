import { describe, expect, it } from 'vitest';
import { safeRedirect } from './safe-redirect';

const BASE = 'https://bureaucracy.example/login';

describe('safeRedirect', () => {
  it('passes same-origin paths through', () => {
    expect(safeRedirect('/members/roster?x=1#top', BASE).toString()).toBe('https://bureaucracy.example/members/roster?x=1#top');
  });

  it('falls back for off-site and malformed targets', () => {
    for (const bad of ['//evil.example', 'http://evil.example', 'https://bureaucracy.example.evil/', '/\\evil.example', 'javascript:alert(1)', '', null, undefined]) {
      expect(safeRedirect(bad, BASE).toString()).toBe('https://bureaucracy.example/');
    }
  });

  it('uses the given fallback', () => {
    expect(safeRedirect(null, BASE, '/dev/shell').pathname).toBe('/dev/shell');
  });
});
