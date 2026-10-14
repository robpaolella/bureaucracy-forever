import { describe, expect, it } from 'vitest';
import { nothingNew, readImportResponse, summarize } from './import-results';

const r = (status: string, extra: object = {}) => ({ id: 'x', type: 'award', status, item: 1, character: 'Gravelstone', ...extra });

describe('summarize', () => {
  it('maps each status to its count', () => {
    const s = summarize([r('recorded'), r('recorded'), r('replayed'), r('voided'), r('pending'), r('rejected', { code: 'key-conflict' }), r('rejected', { code: 'unknown-character' })]);
    expect(s).toMatchObject({ total: 7, recorded: 2, replayed: 1, voided: 1, waiting: 1 });
    expect(s.refused).toEqual([{ item: 1, character: 'Gravelstone', code: 'key-conflict' }]);
    expect(s.unknown).toEqual([{ item: 1, character: 'Gravelstone' }]);
  });

  it('keeps a missing item or character as null', () => {
    expect(summarize([{ id: 'v', type: 'void', status: 'rejected', code: 'user-mismatch' }]).refused).toEqual([{ item: null, character: null, code: 'user-mismatch' }]);
  });
});

describe('nothingNew', () => {
  it('is true only when every award was already there', () => {
    expect(nothingNew(summarize([r('replayed'), r('replayed')]))).toBe(true);
    expect(nothingNew(summarize([r('replayed'), r('recorded')]))).toBe(false);
    expect(nothingNew(summarize([]))).toBe(false);
  });
});

describe('readImportResponse', () => {
  it('reads results', () => {
    expect(readImportResponse(200, { results: [r('recorded')] })).toMatchObject({ kind: 'results', summary: { recorded: 1 } });
  });

  it('reads a whole-paste refusal, with the line for a bad line', () => {
    expect(readImportResponse(400, { error: 'x', code: 'malformed-line', line: 7 })).toEqual({ kind: 'unreadable', code: 'malformed-line', line: 7 });
    expect(readImportResponse(400, { error: 'x', code: 'wrong-raid' })).toEqual({ kind: 'unreadable', code: 'wrong-raid', line: undefined });
  });

  it('treats 413 as unreadable', () => {
    expect(readImportResponse(413, { error: 'big' })).toEqual({ kind: 'unreadable', code: 'too-large' });
  });

  it.each([[404, { error: 'No such raid.' }], [500, { error: 'x' }], [400, { error: 'Send the copied text' }], [200, null]])('treats %s as a failure', (status, body) => {
    expect(readImportResponse(status, body)).toEqual({ kind: 'failed' });
  });
});
