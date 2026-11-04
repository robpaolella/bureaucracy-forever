import { beforeEach, describe, expect, it, vi } from 'vitest';

const write = vi.hoisted(() => vi.fn());
vi.mock('@/lib/addon-batch', () => ({ writeOperationBatch: write }));

import type { Operation } from './addon-operations';
import { parseUpload, recordUpload } from './helper-operations';

// ADDON-SPEC.md section 4.3 (sample data).
const award = (id: string, raid = 'cm9xr2k4a0001') => ({ type: 'award', id, formatVersion: 1, raid, env: 'staging', boss: 'lb_lucifron', item: 16805, char: 'Ana Vale', user: 'u_ana', method: 'HR', roll: 91, sender: 'Rae Quill', at: 1792001200 });
const voidOf = (id: string, key: string, raid = 'cm9xr2k4a0001') => ({ type: 'void', id, formatVersion: 1, raid, env: 'staging', key, reason: 'wrong winner', at: 1792001260 });

const entries = (operations: unknown[]) => {
  const parsed = parseUpload({ operations });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.entries;
};

describe('parseUpload', () => {
  it.each([[null], [[]], ['text'], [{}], [{ operations: {} }]])('refuses the body %j whole', (body) => {
    expect(parseUpload(body)).toMatchObject({ ok: false, status: 400, code: 'bad-request' });
  });

  it('refuses more than 100 records with 413', () => {
    expect(parseUpload({ operations: Array.from({ length: 101 }, (_, i) => award(`aw-${String(i).padStart(8, '0')}`)) })).toMatchObject({ ok: false, status: 413, code: 'too-large' });
    expect(parseUpload({ operations: Array.from({ length: 100 }, (_, i) => award(`aw-${String(i).padStart(8, '0')}`)) }).ok).toBe(true);
  });

  it('answers an unreadable record alone, keeping its id when it has one', () => {
    expect(entries([award('aw-7f3k2m9q'), { ...award('aw-badbadbad'), item: 'x' }, { ...award('aw-newer0001'), formatVersion: 2 }, 7, { id: 42 }])).toEqual([
      { op: expect.objectContaining({ id: 'aw-7f3k2m9q' }) },
      { result: { id: 'aw-badbadbad', status: 'rejected', code: 'bad-record' } },
      { result: { id: 'aw-newer0001', status: 'rejected', code: 'unsupported-version' } },
      { result: { id: null, status: 'rejected', code: 'bad-record' } },
      { result: { id: null, status: 'rejected', code: 'bad-record' } },
    ]);
  });
});

describe('recordUpload', () => {
  beforeEach(() => {
    write.mockReset();
    write.mockImplementation(async ({ operations }: { operations: Operation[] }) => operations.map((op) => ({ id: op.id, status: 'recorded' })));
  });
  const from = { env: 'staging' as const, officerId: 'u_rae', receivedAt: new Date('2026-10-13T20:00:00Z') };

  it('writes one batch per raid, as the key’s officer, and answers in upload order', async () => {
    const results = await recordUpload(entries([voidOf('vd-00000001', 'aw-00000001'), award('aw-00000002', 'other-raid'), { id: 'x' }, award('aw-00000001')]), from);
    expect(results.map((r) => r.id)).toEqual(['vd-00000001', 'aw-00000002', 'x', 'aw-00000001']);
    expect(results[2]).toEqual({ id: 'x', status: 'rejected', code: 'bad-record' });
    expect(write).toHaveBeenCalledTimes(2);
    const [first, second] = write.mock.calls.map(([input]) => input);
    expect(first).toMatchObject({ raidId: 'cm9xr2k4a0001', env: 'staging', officerId: 'u_rae', receivedAt: from.receivedAt, via: 'helper' });
    // The void keeps its place before the award, so the writer holds it and applies it when the award lands.
    expect(first.operations.map((op: Operation) => op.id)).toEqual(['vd-00000001', 'aw-00000001']);
    expect(second).toMatchObject({ raidId: 'other-raid', operations: [expect.objectContaining({ id: 'aw-00000002' })] });
  });

  it('writes nothing when no record is readable', async () => {
    expect(await recordUpload(entries([{ id: 'x' }]), from)).toEqual([{ id: 'x', status: 'rejected', code: 'bad-record' }]);
    expect(write).not.toHaveBeenCalled();
  });

  it('lets a failed batch fail the request', async () => {
    write.mockRejectedValueOnce(new Error('down'));
    await expect(recordUpload(entries([award('aw-00000001')]), from)).rejects.toThrow('down');
  });
});
