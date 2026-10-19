import { beforeEach, describe, expect, it, vi } from 'vitest';

type Note = { id: string; applicationId: string; authorId: string; body: string; source: string; discordMessageId: string; mentions?: unknown };
const store = vi.hoisted(() => ({ notes: [] as Note[], role: 'OFFICER' }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: async () => ({ id: 'u1', discordName: 'Jaina', role: store.role, rank: null, inGuild: true, characters: [] }) },
    application: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'a1' ? { id: 'a1' } : null) },
    officerNote: {
      findUnique: async ({ where }: { where: { discordMessageId: string } }) => store.notes.find((n) => n.discordMessageId === where.discordMessageId) ?? null,
      create: async ({ data }: { data: Omit<Note, 'id'> }) => {
        const note = { ...data, id: `n${store.notes.length + 1}` };
        store.notes.push(note);
        return note;
      },
    },
  },
}));

import { Prisma } from '@/lib/generated/prisma/client';
import { POST } from './route';

const MESSAGE = '100000000000000010';
const note = (over: Record<string, unknown> = {}) => ({ discordMessageId: MESSAGE, authorDiscordId: '100000000000000001', body: 'Ask <@&100000000000000004>', createdAt: '2026-10-18T12:00:00.000Z', ...over });
const post = async (body: unknown, id = 'a1') => {
  const res = await POST(new Request('https://example.test/x', { method: 'POST', headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
};

describe('POST /api/bot/applications/:id/notes', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.notes = [];
    store.role = 'OFFICER';
  });

  it('stores the mentions sent with a note', async () => {
    const mentions = { users: { '100000000000000001': { name: 'Jaina' } }, roles: { '100000000000000004': { name: 'Officer', color: 15844367 } }, channels: { '100000000000000005': { name: 'general' } } };
    expect(await post(note({ mentions }))).toEqual({ status: 201, body: { id: 'n1' } });
    expect(store.notes[0]).toMatchObject({ body: 'Ask <@&100000000000000004>', source: 'DISCORD', mentions });
  });

  it('still accepts a note without mentions', async () => {
    expect((await post(note())).status).toBe(201);
    expect(store.notes[0].mentions).toBe(Prisma.DbNull);
  });

  it('refuses malformed mentions with 400 and stores nothing', async () => {
    const many = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`1000000000000001${String(i).padStart(2, '0')}`, { name: 'x' }]));
    for (const mentions of [{ users: { '12': { name: 'Jaina' } } }, { channels: { '100000000000000005': { name: 'a'.repeat(101) } } }, { roles: { '100000000000000004': { name: 'Officer', color: 2 ** 24 } } }, { users: many }, ['Jaina']]) {
      expect(await post(note({ mentions }))).toEqual({ status: 400, body: { error: expect.any(String) } });
    }
    expect(store.notes).toHaveLength(0);
  });
});
