import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The "Reserves allowed" switch (#451) reaches the add-on's snapshot through loadActiveReserves
 * (#452). Here the database is a small fake that applies the loader's `reservesAllowed` filter to
 * stored reserves, and the real loader, snapshot builder and both routes run on top of it.
 */
const state = vi.hoisted(() => ({ reservesAllowed: true }));
const mocks = vi.hoisted(() => ({ release: vi.fn() }));

const stored = [{ userId: 'u_bo', characterId: 'c_bo', itemId: 16800, kind: 'HR', user: { discordName: 'Bo', rank: 'RAIDER' }, character: { name: 'Bo Marsh', class: 'MAGE' } }];

vi.mock('@/lib/db', () => ({
  db: {
    raid: { findUnique: async () => ({ id: 'cm9xr2k4a0001', name: 'Molten Core - sample', startsAt: new Date(1792000000000), durationMin: 240, cancelledAt: null, templateId: 't1', template: { instance: 409 } }) },
    reserve: { findMany: async ({ where }: { where: { raid?: { reservesAllowed?: boolean } } }) => (where.raid?.reservesAllowed === true && !state.reservesAllowed ? [] : stored) },
    lootAward: { findMany: async () => [] },
  },
}));
vi.mock('@/lib/addon-release', async (real) => ({ ...(await real<typeof import('@/lib/addon-release')>()), getAddonRelease: mocks.release }));
vi.mock('@/lib/loot-data', async (real) => ({
  ...(await real<typeof import('@/lib/loot-data')>()),
  loadLootTable: async () => ({ bosses: [{ id: 'lb_lucifron', name: 'Lucifron', isTrash: false, itemIds: [16800] }], winLimits: {}, blocked: [] }),
}));
vi.mock('@/lib/helper-api', async (real) => ({ ...(await real<typeof import('@/lib/helper-api')>()), guardHelperRequest: async () => ({ userId: 'u1' }) }));
vi.mock('../app/api/_loot', () => ({ requireLootOfficer: async () => ({}) }));
vi.mock('../app/api/_officer', () => ({ NO_STORE: { 'Cache-Control': 'private, no-store' } }));

import { loadSnapshot } from '@/lib/addon-snapshot';
import { GET as helperSnapshot } from '../app/api/helper/raids/[raid]/snapshot/route';
import { GET as copySnapshot } from '../app/api/raids/[id]/snapshot/route';

/** Reads the pasted table literal (ADDON-SPEC 8.2): tables, "strings" with \\ddd escapes, integers, booleans. */
function decodeTable(text: string): unknown {
  let i = 0;
  const value = (): unknown => {
    const c = text[i];
    if (c === '{') return table();
    if (c === '"') return string();
    const word = /^(true|false|-?\d+)/.exec(text.slice(i))![0];
    i += word.length;
    return word === 'true' ? true : word === 'false' ? false : Number(word);
  };
  const string = () => {
    const bytes: number[] = [];
    i += 1;
    while (text[i] !== '"') {
      if (text[i] === '\\') {
        const d = /^\\(\d{3})/.exec(text.slice(i));
        if (d) { bytes.push(Number(d[1])); i += 4; } else { bytes.push(text.charCodeAt(i + 1)); i += 2; }
      } else bytes.push(text.charCodeAt(i++));
    }
    i += 1;
    return new TextDecoder().decode(Uint8Array.from(bytes));
  };
  const table = () => {
    const out: Record<string, unknown> = {};
    const list: unknown[] = [];
    i += 1;
    while (text[i] !== '}') {
      const key = /^(?:\[(\d+)\]|([A-Za-z_]\w*))=/.exec(text.slice(i));
      if (key) { i += key[0].length; out[key[1] ?? key[2]] = value(); } else list.push(value());
      if (text[i] === ',') i += 1;
    }
    i += 1;
    return list.length > 0 ? list : out;
  };
  const result = value();
  if (i !== text.length) throw new Error(`Trailing text at ${i}`);
  return result;
}

const id = 'cm9xr2k4a0001';
const bosses = [{ id: 'lb_lucifron', name: 'Lucifron', trash: false, items: [16800], encounter: 663 }];

beforeEach(() => {
  state.reservesAllowed = true;
  mocks.release.mockResolvedValue({ status: 'none' });
});

describe('the reserve snapshot and the Reserves allowed switch', () => {
  it('holds the reserves while they are on', async () => {
    const snap = (await loadSnapshot(id))!;
    expect(Object.keys(snap.reserves)).toEqual(['16800']);
    expect(snap.bosses).toEqual(bosses);
  });

  it('has an empty reserves map but the full loot table while they are off, and the reserves return when switched back on', async () => {
    state.reservesAllowed = false;
    const off = (await loadSnapshot(id))!;
    expect(off.reserves).toEqual({});
    expect(off.bosses).toEqual(bosses);
    expect(off.instance).toBe(409);
    state.reservesAllowed = true;
    expect(Object.keys((await loadSnapshot(id))!.reserves)).toEqual(['16800']);
  });

  it('gives the helper API an empty reserves map and the full loot table while they are off', async () => {
    state.reservesAllowed = false;
    const res = await helperSnapshot(new Request('https://example.test/x'), { params: Promise.resolve({ raid: id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reserves).toEqual({});
    expect(body.bosses).toEqual(bosses);
  });

  it('gives Copy reserves text whose decoded reserves table is empty while they are off', async () => {
    const decoded = async () => {
      const parts = ((await (await copySnapshot(new Request('https://example.test/x'), { params: Promise.resolve({ id }) })).json()) as { parts: string[] }).parts;
      return decodeTable(parts.map((p) => p.replace(/^BFSNAP1:\d+\/\d+:/, '')).join('')) as { reserves: Record<string, unknown>; bosses: { name: string }[] };
    };
    expect(Object.keys((await decoded()).reserves)).toEqual(['16800']);
    state.reservesAllowed = false;
    const off = await decoded();
    expect(off.reserves).toEqual({});
    expect(off.bosses.map((b) => b.name)).toEqual(['Lucifron']);
  });
});
