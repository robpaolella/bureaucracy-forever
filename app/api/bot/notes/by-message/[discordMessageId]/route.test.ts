import { beforeEach, describe, expect, it, vi } from 'vitest';

type Note = { discordMessageId: string; body: string; editedAt: Date | null; deletedAt: Date | null; mentions?: unknown };
const store = vi.hoisted(() => ({ notes: [] as Note[] }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: {
    officerNote: {
      updateMany: async ({ where, data }: { where: { discordMessageId: string; deletedAt: null }; data: Partial<Note> }) => {
        const n = store.notes.find((x) => x.discordMessageId === where.discordMessageId && !x.deletedAt);
        if (!n) return { count: 0 };
        Object.assign(n, data);
        return { count: 1 };
      },
    },
  },
}));

import { Prisma } from '@/lib/generated/prisma/client';
import { PATCH } from './route';

const MESSAGE = '100000000000000010';
const OLD = { users: { '100000000000000001': { name: 'Jaina' } } };
const patch = async (body: unknown, id = MESSAGE) => {
  const res = await PATCH(new Request('https://example.test/x', { method: 'PATCH', headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ discordMessageId: id }) });
  return { status: res.status, body: await res.json() };
};
const EDITED = { status: 200, body: { discordMessageId: MESSAGE, edited: true } };

describe('PATCH /api/bot/notes/by-message/:discordMessageId', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.notes = [{ discordMessageId: MESSAGE, body: 'Ask <@100000000000000001>', editedAt: null, deletedAt: null, mentions: OLD }];
  });

  it('replaces the stored mentions with the ones sent', async () => {
    const mentions = { roles: { '100000000000000004': { name: 'Officer', color: 0 } } };
    expect(await patch({ body: 'Ask <@&100000000000000004>', mentions })).toEqual(EDITED);
    expect(store.notes[0]).toMatchObject({ body: 'Ask <@&100000000000000004>', mentions, editedAt: expect.any(Date) });
  });

  it('clears the stored mentions when an edit leaves them out', async () => {
    expect(await patch({ body: 'No tags now' })).toEqual(EDITED);
    expect(store.notes[0]).toMatchObject({ body: 'No tags now', mentions: Prisma.DbNull });
  });

  it('refuses malformed mentions with 400 and changes nothing', async () => {
    const many = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`1000000000000001${String(i).padStart(2, '0')}`, { name: 'x' }]));
    for (const mentions of [{ roles: { officer: { name: 'Officer', color: 0 } } }, { users: { '100000000000000001': { name: 'a'.repeat(101) } } }, { roles: { '100000000000000004': { name: 'Officer', color: 16777216 } } }, { channels: many }]) {
      expect(await patch({ body: 'Edited', mentions })).toEqual({ status: 400, body: { error: expect.any(String) } });
    }
    expect(store.notes[0]).toMatchObject({ body: 'Ask <@100000000000000001>', editedAt: null, mentions: OLD });
  });
});
