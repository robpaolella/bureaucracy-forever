/**
 * The snapshot as pasted text (ADDON-SPEC.md sections 3.2 and 8.2): a data-only table literal,
 * cut into `BFSNAP1:<part>/<parts>:<piece>` lines. Data only: tables, strings, integers and
 * booleans; keys are fixed identifiers or integers, never built from site text.
 */
import type { Snapshot } from '@/lib/addon-snapshot';

/** Characters per part, with a margin under the ~7,400 the paste test proved. */
export const PART_MAX = 7_000;

const hex3 = (n: number) => `\\${String(n).padStart(3, '0')}`;

/** Double-quoted; `\` and `"` escaped and every byte outside 0x20-0x7E written as `\ddd` (7.3 rule 4). */
function quote(s: string): string {
  let out = '"';
  for (const byte of new TextEncoder().encode(s)) {
    out += byte === 0x5c ? '\\\\' : byte === 0x22 ? '\\"' : byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : hex3(byte);
  }
  return `${out}"`;
}

function value(v: unknown): string {
  if (typeof v === 'string') return quote(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) throw new Error(`Not an integer: ${v}`);
    return String(v);
  }
  if (Array.isArray(v)) return `{${v.map(value).join(',')}}`;
  if (typeof v === 'object' && v !== null) {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    // Only the reserves map has number-like keys; its item ids are written as `[n]`.
    return `{${entries.map(([k, x]) => `${/^\d+$/.test(k) ? `[${Number(k)}]` : identifier(k)}=${value(x)}`).join(',')}}`;
  }
  throw new Error(`Cannot write ${String(v)}`);
}

const identifier = (k: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw new Error(`Bad key: ${k}`);
  return k;
};

/** The snapshot's table text (the grammar of section 8.2). */
export function snapshotTable(snapshot: Snapshot): string {
  return value(snapshot);
}

/**
 * The pasted lines: one when the table fits, otherwise parts. Each whole line, prefix included,
 * is at most `max` characters (the table is ASCII only, every other byte is escaped).
 */
export function snapshotLines(snapshot: Snapshot, max = PART_MAX): string[] {
  const table = snapshotTable(snapshot);
  // The prefix `BFSNAP1:n/N:` grows with the digits of N, so find the first width that holds.
  for (let digits = 1; ; digits++) {
    const size = max - ('BFSNAP1:'.length + 2 * digits + 2);
    const parts = Math.max(1, Math.ceil(table.length / size));
    if (String(parts).length > digits) continue;
    return Array.from({ length: parts }, (_, i) => `BFSNAP1:${i + 1}/${parts}:${table.slice(i * size, (i + 1) * size)}`);
  }
}
