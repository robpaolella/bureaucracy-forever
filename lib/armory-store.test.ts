import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArmoryClient, ArmoryResult } from './armory';

type Row = { id: string; name: string; level: number | null; levelCheckedAt: Date | null; levelAttemptedAt: Date | null };
const state = vi.hoisted(() => ({ rows: new Map<string, Row>(), after: vi.fn() }));
vi.mock('next/server', () => ({ after: state.after }));
vi.mock('@/lib/db', () => ({
  db: {
    character: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => { const row = state.rows.get(where.id); return row ? { name: row.name } : null; }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; name: { equals: string; mode: 'insensitive' } }; data: Partial<Row> }) => {
        const row = state.rows.get(where.id);
        if (!row || row.name.toLowerCase() !== where.name.equals.toLowerCase()) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
  },
}));
import { lookupAndStoreLevel, queueLevelLookup } from './armory-store';

const old = new Date('2026-11-01T00:00:00Z');
const at = new Date('2026-11-25T12:00:00Z');
const now = () => at;

function client(result: ArmoryResult, during?: () => void): ArmoryClient & { lookupLevel: ReturnType<typeof vi.fn> } {
  return { checkKeys: async () => true, lookupLevel: vi.fn(async () => { during?.(); return result; }) };
}

beforeEach(() => {
  state.rows = new Map([['c1', { id: 'c1', name: 'Sample Name', level: 40, levelCheckedAt: old, levelAttemptedAt: old }]]);
});

describe('lookupAndStoreLevel', () => {
  it('stores a found level with both times', async () => {
    const armory = client({ kind: 'found', level: 58, status: 200 });
    expect(await lookupAndStoreLevel('c1', armory, now)).toBe('found');
    expect(armory.lookupLevel).toHaveBeenCalledWith('Sample Name');
    expect(state.rows.get('c1')).toMatchObject({ level: 58, levelCheckedAt: at, levelAttemptedAt: at });
  });

  it('clears the level when Blizzard has no such profile', async () => {
    expect(await lookupAndStoreLevel('c1', client({ kind: 'not-found', status: 404 }), now)).toBe('not-found');
    expect(state.rows.get('c1')).toMatchObject({ level: null, levelCheckedAt: at, levelAttemptedAt: at });
  });

  it('keeps the old level on a failure and records only the attempt', async () => {
    expect(await lookupAndStoreLevel('c1', client({ kind: 'failed', status: 429 }), now)).toBe('failed');
    expect(state.rows.get('c1')).toMatchObject({ level: 40, levelCheckedAt: old, levelAttemptedAt: at });
  });

  it("doesn't write a result for an old name", async () => {
    const armory = client({ kind: 'found', level: 58, status: 200 }, () => { state.rows.get('c1')!.name = 'Other Name'; });
    expect(await lookupAndStoreLevel('c1', armory, now)).toBe('gone');
    expect(state.rows.get('c1')).toMatchObject({ name: 'Other Name', level: 40, levelCheckedAt: old, levelAttemptedAt: old });
  });

  it('still writes after a capitalisation-only edit, which Blizzard reads as the same name', async () => {
    const armory = client({ kind: 'found', level: 58, status: 200 }, () => { state.rows.get('c1')!.name = 'SAMPLE name'; });
    expect(await lookupAndStoreLevel('c1', armory, now)).toBe('found');
    expect(state.rows.get('c1')).toMatchObject({ level: 58 });
  });

  it('writes nothing for a character deleted during the lookup', async () => {
    const armory = client({ kind: 'found', level: 58, status: 200 }, () => { state.rows.delete('c1'); });
    expect(await lookupAndStoreLevel('c1', armory, now)).toBe('gone');
    expect(state.rows.size).toBe(0);
  });

  it('does not call Blizzard for a character that no longer exists', async () => {
    const armory = client({ kind: 'found', level: 58, status: 200 });
    expect(await lookupAndStoreLevel('missing', armory, now)).toBe('gone');
    expect(armory.lookupLevel).not.toHaveBeenCalled();
  });

  it('never throws into the caller', async () => {
    const armory: ArmoryClient = { checkKeys: async () => true, lookupLevel: async () => { throw new Error('boom'); } };
    expect(await lookupAndStoreLevel('c1', armory, now)).toBe('failed');
    expect(state.rows.get('c1')!.level).toBe(40);
  });

  it('skips the call and writes nothing without Blizzard keys', async () => {
    vi.stubEnv('BLIZZARD_CLIENT_ID', '');
    vi.stubEnv('BLIZZARD_CLIENT_SECRET', '');
    const fetch = vi.spyOn(globalThis, 'fetch');
    vi.resetModules();
    const fresh = await import('./armory-store');
    expect(await fresh.lookupAndStoreLevel('c1')).toBe('skipped');
    expect(fetch).not.toHaveBeenCalled();
    expect(state.rows.get('c1')).toMatchObject({ level: 40, levelAttemptedAt: old });
    fetch.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe('queueLevelLookup', () => {
  beforeEach(() => {
    vi.stubEnv('BLIZZARD_CLIENT_ID', '');
    vi.stubEnv('BLIZZARD_CLIENT_SECRET', '');
    state.after.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('hands the lookup to after() and returns at once', () => {
    expect(queueLevelLookup('c1')).toBeUndefined();
    expect(state.after).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
  });

  it('never throws outside a request, where after() refuses', async () => {
    state.after.mockImplementation(() => { throw new Error('after() was called outside a request scope'); });
    expect(() => queueLevelLookup('c1')).not.toThrow();
    // Without keys the unawaited lookup is skipped: the row is untouched.
    await Promise.resolve();
    expect(state.rows.get('c1')).toMatchObject({ level: 40, levelAttemptedAt: old });
  });
});
