import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ message: null as unknown, users: {} as Record<string, unknown>, lastSent: null as unknown }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: {
    applicantMessage: { findUnique: async () => store.message, findFirst: async () => store.lastSent },
    user: { findUnique: async ({ where }: { where: { id: string } }) => store.users[where.id] ?? null },
  },
}));
import { GET } from './route';

const app = { id: 'a1', status: 'PENDING', discordId: '100000000000000001', character: 'Thrall', discordThreadId: 't1', relayPingAt: null as Date | null };
const msg = (over: Record<string, unknown> = {}) => ({
  id: 'm1', applicationId: 'a1', direction: 'FROM_APPLICANT', authorUserId: null, body: 'Hi', createdAt: new Date('2026-10-12T16:00:00Z'), status: null,
  dmChannelId: 'dc', dmMessageId: 'dm', copyChannelId: null, copyMessageId: null, attachments: [], editedAt: null, deletedAt: null, application: app, ...over,
});
const call = (secret: string | null = 'test-secret') =>
  GET(new Request('https://example.test/api/bot/messages/m1', { headers: secret ? { authorization: `Bearer ${secret}` } : {} }), { params: Promise.resolve({ id: 'm1' }) });

describe('GET /api/bot/messages/:id', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.message = msg();
    store.users = { u1: { discordId: '200000000000000001', discordName: 'Jaina', role: 'OFFICER' } };
    store.lastSent = null;
    app.relayPingAt = null;
  });

  it('refuses a request without the bot secret', async () => {
    expect((await call(null)).status).toBe(401);
  });

  it('404s an unknown id', async () => {
    store.message = null;
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it('returns the §13 shape for an applicant message', async () => {
    const body = await (await call()).json();
    expect(body).toEqual({
      id: 'm1', direction: 'FROM_APPLICANT', status: null, body: 'Hi', createdAt: '2026-10-12T16:00:00.000Z', editedAt: null, deletedAt: null,
      attachments: [], dmChannelId: 'dc', dmMessageId: 'dm', copyChannelId: null, copyMessageId: null, author: null,
      applicant: { discordId: '100000000000000001', characterName: 'Thrall' }, application: { id: 'a1', status: 'PENDING', threadId: 't1' },
      pageUrl: 'https://www.bureauguild.com/officers/applications/a1', ping: 'role',
    });
  });

  it('shows edited and deleted state', async () => {
    store.message = msg({ editedAt: new Date('2026-10-12T17:00:00Z'), deletedAt: new Date('2026-10-12T18:00:00Z') });
    const body = await (await call()).json();
    expect(body.editedAt).toBe('2026-10-12T17:00:00.000Z');
    expect(body.deletedAt).toBe('2026-10-12T18:00:00.000Z');
  });

  it('pings the last messaging officer while they are an officer, else the role', async () => {
    store.lastSent = { authorUserId: 'u1' };
    expect((await (await call()).json()).ping).toBe('200000000000000001');
    store.users.u1 = { discordId: '200000000000000001', discordName: 'Jaina', role: 'MEMBER' };
    expect((await (await call()).json()).ping).toBe('role');
  });

  it('has no ping once a copy exists or within 10 minutes of the last ping', async () => {
    store.message = msg({ copyMessageId: 'c1' });
    expect((await (await call()).json()).ping).toBeNull();
    store.message = msg();
    app.relayPingAt = new Date(Date.now() - 60_000);
    expect((await (await call()).json()).ping).toBeNull();
  });

  it('gives an officer message its author and no ping', async () => {
    store.message = msg({ direction: 'TO_APPLICANT', authorUserId: 'u1', status: 'SENT' });
    const body = await (await call()).json();
    expect(body.author).toEqual({ discordId: '200000000000000001', name: 'Jaina' });
    expect(body.status).toBe('SENT');
    expect(body.ping).toBeNull();
  });
});
