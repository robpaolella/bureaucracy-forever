import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { role: 'officer', discordId: 'd9' } as { role: string; discordId: string } | null,
  loot: true,
  raid: vi.fn(),
  write: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'officer-user' }) }));
vi.mock('@/lib/db', () => ({ db: { raid: { findUnique: mocks.raid } } }));
vi.mock('@/lib/addon-batch', () => ({ writeOperationBatch: mocks.write }));

import { POST } from './route';

const RAID = 'cm9xr2k4a0001';
const HEADER = `BFOUT1;${RAID};PA0001;production`;
const award = (n: number) => `A;aw-${String(n).padStart(8, '0')};lb_lucifron;16805;Ana Vale;u_ana;HR;91;;Rae Quill;${1792001200 + n};`;
const textOf = (lines: string[], end = lines.length) => [HEADER, ...lines, `E;${end}`].join('\n');
const send = (body: unknown, id = RAID) => POST(new Request('https://example.test', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const importText = (text: string) => send({ text });

beforeEach(() => {
  mocks.session = { role: 'officer', discordId: 'd9' };
  mocks.loot = true;
  mocks.raid.mockReset().mockResolvedValue({ id: RAID });
  mocks.write.mockReset().mockImplementation(async ({ operations }: { operations: { id: string }[] }) => operations.map((o) => ({ id: o.id, status: 'recorded' })));
});

describe('POST /api/raids/[id]/loot/import', () => {
  it('imports as the officer and answers each operation with its outcome, item and character', async () => {
    mocks.write.mockResolvedValueOnce([{ id: 'aw-00000001', status: 'rejected', code: 'unknown-character' }, { id: 'aw-00000002', status: 'recorded' }]);
    const res = await importText(textOf([award(1), award(2)]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [
      { id: 'aw-00000001', type: 'award', status: 'rejected', code: 'unknown-character', item: 16805, character: 'Ana Vale' },
      { id: 'aw-00000002', type: 'award', status: 'recorded', item: 16805, character: 'Ana Vale' },
    ] });
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ raidId: RAID, env: 'production', officerId: 'officer-user', via: 'import' }));
  });

  it('applies 250 operations in order in batches of 100', async () => {
    const lines = Array.from({ length: 250 }, (_, i) => award(i + 1));
    const res = await importText(textOf(lines));
    const { results } = await res.json();
    expect(mocks.write.mock.calls.map(([c]) => c.operations.length)).toEqual([100, 100, 50]);
    expect(results.map((r: { id: string }) => r.id)).toEqual(lines.map((_, i) => `aw-${String(i + 1).padStart(8, '0')}`));
  });

  it('records nothing when a late line is malformed, even from earlier batches', async () => {
    const lines = Array.from({ length: 250 }, (_, i) => (i === 229 ? 'garbage' : award(i + 1)));
    const res = await importText(textOf(lines));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'malformed-line', line: 231 });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('keeps earlier batches and answers 500 when a later one fails', async () => {
    mocks.write.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: `aw-${String(i + 1).padStart(8, '0')}`, status: 'recorded' }))).mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await importText(textOf(Array.from({ length: 150 }, (_, i) => award(i + 1))));
    expect(res.status).toBe(500);
    expect(mocks.write).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['wrong-raid', textOf([award(1)]).replace(RAID, 'cmzzzzzzz9999')],
    ['wrong-environment', textOf([award(1)]).replace('PA0001;production', 'SA0001;staging')],
    ['no-end-line', [HEADER, award(1)].join('\n')],
    ['count-mismatch', textOf([award(1)], 2)],
    ['unreadable-header', 'hello'],
  ])('refuses %s with 400 and records nothing', async (code, text) => {
    const res = await importText(text);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('refuses over 64 KiB with 413, counting bytes, and records nothing', async () => {
    expect((await importText('é'.repeat(32 * 1024 + 1))).status).toBe(413);
    expect((await importText('x'.repeat(64 * 1024 + 1))).status).toBe(413);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('does not refuse a valid text under the limit whose JSON form is longer than 64 KiB', async () => {
    const lines = Array.from({ length: 1200 }, (_, i) => `V;vd-${String(i).padStart(8, '0')};aw-00000001;${'"'.repeat(10)};${1792001200 + i};`);
    const text = textOf(lines);
    const body = JSON.stringify({ text });
    expect(new TextEncoder().encode(text).length).toBeLessThan(64 * 1024);
    expect(body.length).toBeGreaterThan(64 * 1024 + 1024);
    const res = await POST(new Request('https://example.test', { method: 'POST', headers: { 'content-length': String(body.length) }, body }), { params: Promise.resolve({ id: RAID }) });
    expect(res.status).toBe(200);
    expect((await res.json()).results).toHaveLength(1200);
  });

  it('refuses a body that is not { text }', async () => {
    expect((await send('nope')).status).toBe(400);
    expect((await send({ text: 5 })).status).toBe(400);
  });

  it('answers 404 for a raid that does not exist', async () => {
    mocks.raid.mockResolvedValue(null);
    expect((await importText(textOf([award(1)]))).status).toBe(404);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it.each([
    ['a member', { role: 'member', discordId: 'd1' }, 403],
    ['a social member', { role: 'social', discordId: 'd2' }, 403],
    ['a signed-out request', null, 401],
  ])('refuses %s', async (_name, session, status) => {
    mocks.session = session;
    expect((await importText(textOf([award(1)]))).status).toBe(status);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('answers 404 when the loot log is off', async () => {
    mocks.loot = false;
    expect((await importText(textOf([award(1)]))).status).toBe(404);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
