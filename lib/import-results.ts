/**
 * What the officer sees after pasting the add-on's copy-out text: the answer of
 * POST /api/raids/{id}/loot/import (ADDON-SPEC 12) read into counts and lists.
 */

export type ImportResult = { id: string; type: string; status: string; code?: string; item?: number | null; character?: string | null };

export type ImportedAward = { item: number | null; character: string | null };
export type Refused = ImportedAward & { code: string };

export type ImportSummary = {
  total: number;
  recorded: number;
  replayed: number;
  voided: number;
  waiting: number;
  refused: Refused[];
  /** Characters the site doesn't know; recorded by hand. */
  unknown: ImportedAward[];
};

/** Everything in the paste was already in the loot log. */
export const nothingNew = (s: ImportSummary) => s.total > 0 && s.replayed === s.total;

export function summarize(results: ImportResult[]): ImportSummary {
  const s: ImportSummary = { total: results.length, recorded: 0, replayed: 0, voided: 0, waiting: 0, refused: [], unknown: [] };
  for (const r of results) {
    const award = { item: r.item ?? null, character: r.character ?? null };
    if (r.status === 'recorded') s.recorded++;
    else if (r.status === 'replayed') s.replayed++;
    else if (r.status === 'voided') s.voided++;
    else if (r.status === 'pending') s.waiting++;
    else if (r.code === 'unknown-character') s.unknown.push(award);
    else s.refused.push({ ...award, code: r.code ?? '' });
  }
  return s;
}

export type ImportOutcome =
  | { kind: 'results'; summary: ImportSummary }
  /** The whole paste was refused; nothing was recorded. */
  | { kind: 'unreadable'; code: string; line?: number }
  /** The server's answer proves nothing was recorded (a missing raid, a bad request). */
  | { kind: 'failed' }
  /** A server error, an unreadable answer or a dropped connection: earlier batches of the paste may be recorded. */
  | { kind: 'stopped' };

/** Reads the import route's answer; anything it doesn't expect is a failure the officer can retry, a 4xx one that recorded nothing, anything else one that may have recorded part of the paste. */
export function readImportResponse(status: number, body: unknown): ImportOutcome {
  const json = (typeof body === 'object' && body !== null ? body : {}) as { results?: unknown; code?: unknown; line?: unknown };
  if (status === 200 && Array.isArray(json.results)) return { kind: 'results', summary: summarize(json.results as ImportResult[]) };
  if (status === 413) return { kind: 'unreadable', code: 'too-large' };
  if (status === 400 && typeof json.code === 'string') return { kind: 'unreadable', code: json.code, line: typeof json.line === 'number' ? json.line : undefined };
  // A 4xx proves the paste was refused before anything was applied; anything else may have recorded part of it.
  return status >= 400 && status < 500 ? { kind: 'failed' } : { kind: 'stopped' };
}
