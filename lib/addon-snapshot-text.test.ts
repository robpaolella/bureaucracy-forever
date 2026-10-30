import { describe, expect, it } from 'vitest';
import { buildSnapshot, type Snapshot, type SnapshotInput } from '@/lib/addon-snapshot';
import { snapshotLines, snapshotTable } from '@/lib/addon-snapshot-text';

/** A reader for the grammar of ADDON-SPEC 8.2 (never executes anything). Integer keys read back as strings. */
function read(text: string): unknown {
  let i = 0;
  const ws = () => { while (/\s/.test(text[i] ?? '')) i++; };
  const fail = (): never => { throw new Error(`parse error at ${i}`); };
  const string = () => {
    const bytes: number[] = [];
    i++;
    for (;;) {
      const c = text[i];
      if (c === undefined) fail();
      if (c === '"') { i++; break; }
      if (c === '\\') {
        const d = text.slice(i + 1, i + 4);
        if (d === '\\' || text[i + 1] === '\\' || text[i + 1] === '"') { bytes.push(text.charCodeAt(i + 1)); i += 2; continue; }
        if (!/^\d{3}$/.test(d)) fail();
        bytes.push(Number(d)); i += 4; continue;
      }
      bytes.push(text.charCodeAt(i++));
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  };
  const value = (): unknown => {
    ws();
    if (text[i] === '"') return string();
    if (text.startsWith('true', i)) { i += 4; return true; }
    if (text.startsWith('false', i)) { i += 5; return false; }
    const num = /^-?\d+/.exec(text.slice(i));
    if (num) { i += num[0].length; return Number(num[0]); }
    if (text[i] !== '{') fail();
    i++;
    const list: unknown[] = [];
    const map: Record<string, unknown> = {};
    let keyed = false;
    for (;;) {
      ws();
      if (text[i] === '}') { i++; break; }
      const key = /^([A-Za-z_]\w*)\s*=|^\[(\d+)\]\s*=/.exec(text.slice(i));
      if (key) { i += key[0].length; map[key[1] ?? key[2]] = value(); keyed = true; } else list.push(value());
      ws();
      if (text[i] === ',') i++; else if (text[i] !== '}') fail();
    }
    return keyed ? map : list;
  };
  const v = value();
  ws();
  if (i !== text.length) fail();
  return v;
}

const sample = (): SnapshotInput => ({
  raid: { id: 'cm9xr2k4a0001', name: 'Molten Core - sample', startsAt: new Date(1792000000 * 1000), durationMin: 240 },
  env: 'staging',
  now: new Date(1791990000 * 1000),
  bosses: [{ id: 'lb_lucifron', name: 'Lucifron', trash: false, items: [16800, 16805] }, { id: 'lb_trash', name: 'Trash', trash: true, items: [18861] }],
  reserves: [
    { userId: 'u_ana', characterId: 'c_ana', characterName: 'Ana Vale', itemId: 16805, kind: 'HR', onTrial: false },
    { userId: 'u_cy', characterId: 'c_cy', characterName: 'Cy Orchard', itemId: 16805, kind: 'SR', onTrial: true },
  ],
  winLimits: {},
  earlierWins: [{ characterId: 'c_cy', itemId: 16805 }],
  awards: [{ id: '0001abcd', requestKey: null, bossId: 'lb_trash', itemId: 18861, characterName: 'Dee Holt', userId: 'u_dee', method: 'OPEN_ROLL', roll: 64, voidedAt: null }],
});
// What a reader should get back: the snapshot's own tree.
const expected = () => JSON.parse(JSON.stringify(buildSnapshot(sample())));

const joined = (lines: string[]) => lines.map((l) => l.replace(/^BFSNAP1:\d+\/\d+:/, '')).join('');

describe('snapshot text', () => {
  it('writes data only, with item ids as integer keys, and reads back to the same tree', () => {
    const text = snapshotTable(buildSnapshot(sample()));
    expect(text).toContain('[16805]=');
    expect(text).not.toMatch(/function|loadstring|\bnil\b|--|\bend\b/);
    expect(read(text)).toEqual(expected());
  });

  it('writes a boss\'s encounter id as an integer, and leaves the field out when absent', () => {
    const input = sample();
    input.raid.instance = 3065;
    input.bosses = [{ id: 'b1', name: 'Plunder', trash: false, items: [1] }, { id: 'b2', name: 'Unknown', trash: false, items: [2] }];
    const text = snapshotTable(buildSnapshot(input));
    expect(text).toContain('encounter=3494');
    expect(text.match(/encounter=/g)).toHaveLength(1);
    expect(read(text)).toEqual(JSON.parse(JSON.stringify(buildSnapshot(input))));
  });

  it('escapes quotes, backslashes and non-ASCII bytes as decimal, and reads them back', () => {
    const snap = buildSnapshot({ ...sample(), raid: { ...sample().raid, name: 'A "q" \\ ü\n]] --' } });
    const text = snapshotTable(snap);
    expect(text).toContain('A \\"q\\" \\\\ \\195\\188\\010]] --');
    expect(/[^\x20-\x7e]/.test(text)).toBe(false);
    expect((read(text) as Snapshot).name).toBe('A "q" \\ ü\n]] --');
  });

  it('leaves a snapshot that fits as one BFSNAP1:1/1 line', () => {
    const lines = snapshotLines(buildSnapshot(sample()));
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('BFSNAP1:1/1:')).toBe(true);
    expect(read(joined(lines))).toEqual(expected());
  });

  it('splits long text into labelled lines of at most 7,000 characters that join to the whole', () => {
    const input = sample();
    input.reserves = Array.from({ length: 400 }, (_, n) => ({ userId: `u${n}`, characterId: `c${n}`, characterName: `Player Number${n}`, itemId: 16805, kind: 'SR' as const, onTrial: false }));
    const snap = buildSnapshot(input);
    const lines = snapshotLines(snap);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((line, n) => {
      expect(line.length).toBeLessThanOrEqual(7000);
      expect(line.startsWith(`BFSNAP1:${n + 1}/${lines.length}:`)).toBe(true);
    });
    expect(joined(lines)).toBe(snapshotTable(snap));
    expect(read(joined(lines))).toEqual(JSON.parse(JSON.stringify(snap)));
  });

  it('keeps every line under the limit when the part count gains a digit', () => {
    const lines = snapshotLines(buildSnapshot(sample()), 40);
    expect(lines.length).toBeGreaterThan(9);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(40);
    expect(read(joined(lines))).toEqual(expected());
  });
});
