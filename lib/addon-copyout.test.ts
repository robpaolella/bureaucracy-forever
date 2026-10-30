import { describe, expect, it } from 'vitest';
import { parseCopyout, raidCode } from './addon-copyout';

// ADDON-SPEC.md section 12's worked example (sample data).
const RAID = 'cm9xr2k4a0001';
const HEADER = `BFOUT1;${RAID};SA0001;staging`;
const LINES = [
  'A;aw-7f3k2m9q;lb_lucifron;16805;Ana Vale;u_ana;HR;91;;Rae Quill;1792001200;',
  'K;cf-1x8p4d2s;aw-7f3k2m9q;1792001204;',
  'A;aw-8d3c5n2a;lb_trash;17011;Dee Holt;u_dee;OPEN_ROLL;64;;Rae Quill;1792001230;',
  'V;vd-5b2n8c1w;aw-8d3c5n2a;wrong winner;1792001260;',
  'R;rp-9c4v6t0e;aw-7f3k2m9q;1792001300;;aw-2h6j9z4b;lb_lucifron;16805;Bo Marsh;u_bo;SR;77;;Rae Quill;1792001300',
];
const text = (lines = LINES, { header = HEADER, end = `E;${lines.length}` } = {}) => [header, ...lines, end].join('\n');
const parse = (t: string, env: 'production' | 'staging' = 'staging') => parseCopyout(t, RAID, env);

describe('raidCode', () => {
  it('is P or S and the last five characters, upper-case', () => {
    expect(raidCode(RAID, 'staging')).toBe('SA0001');
    expect(raidCode('cm9xr2k4a0001', 'production')).toBe('PA0001');
  });
});

describe('parseCopyout', () => {
  it('reads the worked example into its five operations with raid and env from the header', () => {
    const result = parse(text());
    expect(result.ok && result.operations).toEqual([
      { type: 'award', id: 'aw-7f3k2m9q', formatVersion: 1, raid: RAID, env: 'staging', practice: false, at: 1792001200, boss: 'lb_lucifron', item: 16805, char: 'Ana Vale', user: 'u_ana', method: 'HR', roll: 91, note: null, sender: 'Rae Quill' },
      { type: 'confirm', id: 'cf-1x8p4d2s', formatVersion: 1, raid: RAID, env: 'staging', practice: false, at: 1792001204, key: 'aw-7f3k2m9q' },
      { type: 'award', id: 'aw-8d3c5n2a', formatVersion: 1, raid: RAID, env: 'staging', practice: false, at: 1792001230, boss: 'lb_trash', item: 17011, char: 'Dee Holt', user: 'u_dee', method: 'OPEN_ROLL', roll: 64, note: null, sender: 'Rae Quill' },
      { type: 'void', id: 'vd-5b2n8c1w', formatVersion: 1, raid: RAID, env: 'staging', practice: false, at: 1792001260, key: 'aw-8d3c5n2a', reason: 'wrong winner' },
      {
        type: 'replace', id: 'rp-9c4v6t0e', formatVersion: 1, raid: RAID, env: 'staging', practice: false, at: 1792001300, key: 'aw-7f3k2m9q',
        award: { type: 'award', id: 'aw-2h6j9z4b', formatVersion: 1, raid: RAID, env: 'staging', practice: false, at: 1792001300, boss: 'lb_lucifron', item: 16805, char: 'Bo Marsh', user: 'u_bo', method: 'SR', roll: 77, note: null, sender: 'Rae Quill' },
      },
    ]);
  });

  it('reads not-confirmed, a disenchant with no winner, and tolerates CRLF and trailing blank lines', () => {
    const lines = ['N;nc-1x8p4d2s;aw-7f3k2m9q;1792001204;', 'A;aw-9a3k2m9q;lb_trash;17011;;;DISENCHANT_BANK;;;Rae Quill;1792001210;'];
    const result = parse(`${text(lines)}\n\n`.replace(/\n/g, '\r\n'));
    expect(result.ok && result.operations.map((o) => o.type)).toEqual(['not-confirmed', 'award']);
    expect(result.ok && result.operations[1]).toMatchObject({ char: null, user: null, roll: null });
  });

  it('passes the practice mark through, including to a replacement\'s new award', () => {
    const practice = [LINES[0].replace(/;$/, ';1'), LINES[4].replace('1792001300;;aw-2', '1792001300;1;aw-2')];
    const result = parse(text(practice));
    expect(result.ok && result.operations.map((o) => o.practice)).toEqual([true, true]);
    expect(result.ok && result.operations[1].type === 'replace' && result.operations[1].award.practice).toBe(true);
  });

  it('decodes 9.3 escapes in text fields, including multi-byte characters', () => {
    const note = LINES[0].replace(';;Rae', ';a%3Bb %E2%9C%93 caf\u00e9%25;Rae');
    const result = parse(text([note]));
    expect(result.ok && result.operations[0]).toMatchObject({ note: 'a;b \u2713 caf\u00e9%' });
  });

  it.each([
    ['a stray percent', 'a%ZZ'],
    ['a percent cut short', 'a%4'],
    ['invalid UTF-8', '%FF'],
  ])('rejects %s as a malformed line', (_name, note) => {
    expect(parse(text([LINES[1], LINES[0].replace(';;Rae', `;${note};Rae`)]))).toEqual({ ok: false, code: 'malformed-line', line: 3 });
  });

  it('rejects a header for another raid, by id or by code', () => {
    expect(parse(text(LINES, { header: 'BFOUT1;other-raid-id1;SA0001;staging' }))).toEqual({ ok: false, code: 'wrong-raid' });
    expect(parse(text(LINES, { header: `BFOUT1;${RAID};SB0002;staging` }))).toEqual({ ok: false, code: 'wrong-raid' });
  });

  it('rejects the other environment', () => {
    expect(parse(text(LINES, { header: `BFOUT1;${RAID};PA0001;production` }))).toEqual({ ok: false, code: 'wrong-environment' });
    expect(parse(text(), 'production')).toEqual({ ok: false, code: 'wrong-environment' });
  });

  it.each(['', 'hello', 'BFOUT2;x;y;staging', `BFOUT1;${RAID};SA0001`, `BFOUT1;${RAID};SA0001;moon`])('rejects header %j as unreadable', (header) => {
    expect(parse(text(LINES, { header }))).toEqual({ ok: false, code: 'unreadable-header' });
  });

  it('rejects a text with no E line (a cut-off paste), even with a half-written last line', () => {
    expect(parse([HEADER, ...LINES].join('\n'))).toEqual({ ok: false, code: 'no-end-line' });
    expect(parse([HEADER, ...LINES.slice(0, 2), 'A;aw-8d3c5n'].join('\n'))).toEqual({ ok: false, code: 'no-end-line' });
    expect(parse(HEADER)).toEqual({ ok: false, code: 'no-end-line' });
    expect(parse(text(LINES, { end: 'E;x' }))).toEqual({ ok: false, code: 'no-end-line' });
  });

  it('rejects a count that differs from the number of operation lines', () => {
    expect(parse(text(LINES, { end: 'E;4' }))).toEqual({ ok: false, code: 'count-mismatch' });
    expect(parse(text(LINES, { end: 'E;6' }))).toEqual({ ok: false, code: 'count-mismatch' });
  });

  it('accepts an empty list', () => {
    expect(parse(text([]))).toEqual({ ok: true, operations: [] });
  });

  it.each([
    ['an unknown type', 'X;a;b'],
    ['too few fields', 'K;cf-1x8p4d2s;aw-7f3k2m9q;1792001204'],
    ['too many fields', 'K;cf-1x8p4d2s;aw-7f3k2m9q;1792001204;;'],
    ['a bad practice mark', 'K;cf-1x8p4d2s;aw-7f3k2m9q;1792001204;yes'],
    ['a bad time', 'K;cf-1x8p4d2s;aw-7f3k2m9q;soon;'],
    ['a blank line', ''],
    ['an unknown method', LINES[0].replace(';HR;', ';XX;')],
    ['a text roll', LINES[0].replace(';91;', ';ninety;')],
    ['a key the same as the id', 'K;cf-1x8p4d2s;cf-1x8p4d2s;1792001204;'],
    ['an E line in the middle', 'E;1'],
  ])('rejects %s as a malformed line, naming its number', (_name, bad) => {
    expect(parse(text([LINES[0], bad, LINES[1]], { end: bad === '' || bad === 'E;1' ? 'E;3' : undefined }))).toEqual({ ok: false, code: 'malformed-line', line: 3 });
  });
});
