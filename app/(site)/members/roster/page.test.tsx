import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RosterRow } from '@/lib/roster';

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn(), rows: [] as RosterRow[] }));
vi.mock('@/lib/db', () => ({ db: { user: { findMany: mocks.findMany, findUnique: mocks.findUnique } } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ discordId: 'viewer', rank: 'raider' }) }));
vi.mock('@/components/roster/RosterTable', () => ({ RosterTable: ({ rows }: { rows: RosterRow[] }) => { mocks.rows = rows; return null; } }));
import RosterPage from './page';

const character = (id: string, isMain: boolean) => ({ id, name: id, isMain, class: 'MAGE', spec: 'Frost', raidRole: 'RANGED', attendance: 0.9, joinedAt: new Date('2026-01-01') });
const user = (id: string, characters: ReturnType<typeof character>[]) => ({ id, discordName: id, rank: 'RAIDER', createdAt: new Date('2025-01-01'), characters });
beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(null); });

it('loads ordered characters in one roster query and keeps the separate viewer query', async () => {
  mocks.findMany.mockResolvedValue([user('member', [character('Main', true), character('Alt', false)])]);
  renderToStaticMarkup(await RosterPage());
  expect(mocks.findMany).toHaveBeenCalledTimes(1);
  const query = mocks.findMany.mock.calls[0][0];
  expect(query.select.characters.orderBy).toEqual([{ isMain: 'desc' }, { name: 'asc' }]);
  expect(query.select.characters.where).toBeUndefined();
  expect(query.select.characters.take).toBeUndefined();
  expect(mocks.findUnique).toHaveBeenCalledTimes(1);
  expect(mocks.rows[0]).toMatchObject({ character: 'Main', alts: [{ id: 'Alt', name: 'Alt', wowClass: 'mage', spec: 'Frost', role: 'ranged' }] });
});

it('does not treat an orphaned alt as a main or show its lines', async () => {
  mocks.findMany.mockResolvedValue([user('empty', []), user('orphan', [character('Alt', false)]), user('main-only', [character('Main', true)])]);
  renderToStaticMarkup(await RosterPage());
  expect(mocks.rows.slice(0, 2)).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'empty', character: null, alts: [], wowClass: null, attendance: null }),
    expect.objectContaining({ id: 'orphan', character: null, alts: [], wowClass: null, attendance: null }),
  ]));
  expect(mocks.rows[2]).toMatchObject({ character: 'Main', alts: [] });
});
