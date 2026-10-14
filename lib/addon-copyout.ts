/**
 * The add-on's copy-out text (ADDON-SPEC.md section 12): a header, one operation text
 * (section 10.1, escaped by 9.3) per line, and a closing `E;<count>`. Pure: it turns the text
 * into the objects `parseOperation` reads, or says why the whole text is refused. Nothing is
 * applied from a text that fails any check, so a cut-off paste is never half-applied.
 */
import { parseOperation, type Operation, type SiteEnv } from '@/lib/addon-operations';

/** Why a whole text is refused; `malformed-line` carries the line's number (the header is line 1). */
export type CopyoutError =
  | { code: 'unreadable-header' | 'wrong-raid' | 'wrong-environment' | 'no-end-line' | 'count-mismatch' }
  | { code: 'malformed-line'; line: number };
export type CopyoutResult = { ok: true; operations: Operation[] } | ({ ok: false } & CopyoutError);

/** The raid code of section 2: P or S, then the last five characters of the raid id, upper-case. */
export const raidCode = (raidId: string, env: SiteEnv) => `${env === 'staging' ? 'S' : 'P'}${raidId.slice(-5).toUpperCase()}`;

/** 9.3: `%XX` (two hex digits) decodes to a byte; any other `%`, or invalid UTF-8, is malformed. */
function unescape(field: string): string | null {
  if (/%(?![0-9A-Fa-f]{2})/.test(field)) return null;
  const bytes: number[] = [];
  for (const part of field.split(/(%[0-9A-Fa-f]{2})/)) {
    if (part.length === 3 && part[0] === '%') bytes.push(parseInt(part.slice(1), 16));
    else bytes.push(...new TextEncoder().encode(part));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

const DIGITS = /^\d+$/;
/** An empty field means "none". */
const orNull = (v: string) => (v === '' ? null : v);
const num = (v: string) => (v === '' ? null : DIGITS.test(v) ? Number(v) : NaN);

/** Fields 10.1 names for an award, from `id` to `at`. */
function awardFields(f: string[], withPractice: boolean) {
  const [id, boss, item, char, user, method, roll, note, sender, at, practice] = f;
  return { id, boss, item: num(item), char: orNull(char), user: orNull(user), method, roll: num(roll), note: orNull(note), sender, at: DIGITS.test(at) ? Number(at) : NaN, ...(withPractice ? { practice: practice === '1' } : {}) };
}

const SIZES: Record<string, number> = { A: 12, K: 5, N: 5, V: 6, R: 15 };

/** One operation text as the object `parseOperation` takes, or null if its shape is wrong. */
function lineToObject(line: string, base: { formatVersion: 1; raid: string; env: SiteEnv }): Record<string, unknown> | null {
  const raw = line.split(';');
  if (raw.length !== SIZES[raw[0]]) return null;
  const f: string[] = [];
  for (const field of raw) {
    const decoded = unescape(field);
    if (decoded === null) return null;
    f.push(decoded);
  }
  const practiceOk = (v: string) => v === '' || v === '1';
  const at = (v: string) => (DIGITS.test(v) ? Number(v) : NaN);
  switch (raw[0]) {
    case 'A':
      return practiceOk(f[11]) ? { ...base, type: 'award', ...awardFields(f.slice(1), true) } : null;
    case 'K':
    case 'N':
      return practiceOk(f[4]) ? { ...base, type: raw[0] === 'K' ? 'confirm' : 'not-confirmed', id: f[1], key: f[2], at: at(f[3]), practice: f[4] === '1' } : null;
    case 'V':
      return practiceOk(f[5]) ? { ...base, type: 'void', id: f[1], key: f[2], reason: orNull(f[3]), at: at(f[4]), practice: f[5] === '1' } : null;
    default: {
      // R: the new award takes the replace's practice mark.
      if (!practiceOk(f[4])) return null;
      const practice = f[4] === '1';
      return { ...base, type: 'replace', id: f[1], key: f[2], at: at(f[3]), practice, award: { ...base, type: 'award', ...awardFields(f.slice(5), false), practice } };
    }
  }
}

/** Reads a copy-out text for `raidId` on a site in `env`; every check runs before anything is returned. */
export function parseCopyout(input: string, raidId: string, env: SiteEnv): CopyoutResult {
  const lines = input.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const header = (lines[0] ?? '').trim().split(';');
  if (header.length !== 4 || header[0] !== 'BFOUT1' || !header[1] || !header[2] || (header[3] !== 'production' && header[3] !== 'staging')) return { ok: false, code: 'unreadable-header' };
  if (header[1] !== raidId || header[2] !== raidCode(raidId, header[3])) return { ok: false, code: 'wrong-raid' };
  if (header[3] !== env) return { ok: false, code: 'wrong-environment' };

  const end = /^E;(\d+)$/.exec(lines.length > 1 ? lines[lines.length - 1].trim() : '');
  if (!end) return { ok: false, code: 'no-end-line' };
  const body = lines.slice(1, -1);
  if (Number(end[1]) !== body.length) return { ok: false, code: 'count-mismatch' };

  const operations: Operation[] = [];
  const base = { formatVersion: 1 as const, raid: raidId, env };
  for (const [index, line] of body.entries()) {
    const object = lineToObject(line, base);
    const parsed = object && parseOperation(object);
    if (!parsed?.ok) return { ok: false, code: 'malformed-line', line: index + 2 };
    operations.push(parsed.value);
  }
  return { ok: true, operations };
}
