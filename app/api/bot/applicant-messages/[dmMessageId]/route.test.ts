import { beforeEach, describe, expect, it, vi } from 'vitest';

type Msg = { id: string; applicationId: string; direction: string; dmMessageId: string; body: string; attachments: unknown[]; editedAt: Date | null; deletedAt: Date | null; mentions?: unknown };
const store = vi.hoisted(() => ({ apps: {} as Record<string, string>, messages: [] as Msg[], enqueue: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/outbox', () => ({ enqueue: store.enqueue }));
vi.mock('@/lib/db', async () => {
  const { Prisma } = await import('@/lib/generated/prisma/client');
  const withApp = (m: Msg) => ({ ...m, application: { status: store.apps[m.applicationId] } });
  const tx = {
    applicantMessage: {
      findUnique: async ({ where }: { where: { dmMessageId: string } }) => {
        const m = store.messages.find((x) => x.dmMessageId === where.dmMessageId);
        return m ? withApp(m) : null;
      },
      updateMany: async ({ where, data }: { where: { id: string; deletedAt: null; application: { status: string } }; data: Partial<Msg> }) => {
        const m = store.messages.find((x) => x.id === where.id && !x.deletedAt && store.apps[x.applicationId] === where.application.status);
        if (!m) return { count: 0 };
        Object.assign(m, data);
        return { count: 1 };
      },
    },
  };
  const requests = new Map<string, { key: string; statusCode: number; body: unknown; createdAt: Date }>();
  const botRequest = {
    create: async ({ data }: { data: { key: string; statusCode: number; body: unknown; createdAt: Date } }) => {
      if (requests.has(data.key)) throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
      requests.set(data.key, data);
    },
    findUnique: async ({ where }: { where: { key: string } }) => requests.get(where.key) ?? null,
    updateMany: async ({ where, data }: { where: { key: string }; data: object }) => {
      Object.assign(requests.get(where.key)!, data);
      return { count: 1 };
    },
    deleteMany: async ({ where }: { where: { key: string } }) => ({ count: requests.delete(where.key) ? 1 : 0 }),
  };
  return { db: { ...tx, botRequest, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

import { Prisma } from '@/lib/generated/prisma/client';
import { DELETE, PATCH } from './route';

const DM = '100000000000000003';
const seed = (over: Partial<Msg> = {}, status = 'PENDING') => {
  store.apps.a1 = status;
  store.messages.push({ id: 'm1', applicationId: 'a1', direction: 'FROM_APPLICANT', dmMessageId: DM, body: 'Hello', attachments: [], editedAt: null, deletedAt: null, ...over });
};
const headers = (key?: string) => ({ authorization: 'Bearer test-secret', 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) });
const patch = async (body: unknown, id = DM, key?: string) => {
  const res = await PATCH(new Request('https://example.test/x', { method: 'PATCH', headers: headers(key), body: JSON.stringify(body) }), { params: Promise.resolve({ dmMessageId: id }) });
  return { status: res.status, body: await res.json() };
};
const del = async (id = DM) => {
  const res = await DELETE(new Request('https://example.test/x', { method: 'DELETE', headers: headers() }), { params: Promise.resolve({ dmMessageId: id }) });
  return { status: res.status, body: await res.json() };
};
const copyJob = ['application.message.copy', { applicationId: 'a1', messageId: 'm1' }, expect.anything()];
const CHANGED = { status: 200, body: { changed: true, applicationId: 'a1', messageId: 'm1' } };
const UNCHANGED = { status: 200, body: { changed: false } };

describe('/api/bot/applicant-messages/:dmMessageId', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.apps = {};
    store.messages = [];
    store.enqueue.mockReset();
  });

  it('refuses a request without the bot secret', async () => {
    seed();
    const res = await PATCH(new Request('https://example.test/x', { method: 'PATCH', body: '{}' }), { params: Promise.resolve({ dmMessageId: DM }) });
    expect(res.status).toBe(401);
    const gone = await DELETE(new Request('https://example.test/x', { method: 'DELETE' }), { params: Promise.resolve({ dmMessageId: DM }) });
    expect(gone.status).toBe(401);
    expect(store.messages[0].deletedAt).toBeNull();
  });

  describe('PATCH', () => {
    it('edits a pending message, sets editedAt and queues one copy', async () => {
      seed();
      expect(await patch({ body: 'Hello again' })).toEqual(CHANGED);
      expect(store.messages[0]).toMatchObject({ body: 'Hello again', editedAt: expect.any(Date) });
      expect(store.enqueue).toHaveBeenCalledExactlyOnceWith(...copyJob);
    });

    it('does nothing for an unknown id, a decided application, a deleted message or an officer message', async () => {
      expect(await patch({ body: 'x' }, '100000000000000099')).toEqual(UNCHANGED);
      expect(await patch({ body: 'x' }, 'not-an-id')).toEqual(UNCHANGED);
      seed({}, 'ACCEPTED');
      expect(await patch({ body: 'x' })).toEqual(UNCHANGED);
      store.messages = [];
      seed({ deletedAt: new Date() });
      expect(await patch({ body: 'x' })).toEqual(UNCHANGED);
      store.messages = [];
      seed({ direction: 'TO_APPLICANT' });
      expect(await patch({ body: 'x' })).toEqual(UNCHANGED);
      expect(store.enqueue).not.toHaveBeenCalled();
    });

    it('treats an edit that changes nothing as unchanged', async () => {
      seed();
      expect(await patch({ body: 'Hello' })).toEqual(UNCHANGED);
      expect(store.messages[0].editedAt).toBeNull();
      expect(store.enqueue).not.toHaveBeenCalled();
    });

    it('accepts 4,000 characters and refuses 4,001, counting an emoji as one', async () => {
      seed();
      expect((await patch({ body: '😀'.repeat(4000) })).body.changed).toBe(true);
      const over = await patch({ body: 'a'.repeat(4001) });
      expect(over).toEqual({ status: 400, body: { reason: 'invalid', error: expect.any(String) } });
    });

    it('refuses a body that is not text', async () => {
      seed();
      expect((await patch({ body: 5 })).status).toBe(400);
    });

    it('accepts empty text only when the stored message has an attachment', async () => {
      seed();
      expect((await patch({ body: '  ' })).status).toBe(400);
      expect((await patch({})).status).toBe(400);
      store.messages = [];
      seed({ attachments: [{ id: '100000000000000009', filename: 'a.png', size: 1, spoiler: false }] });
      expect(await patch({ body: '' })).toEqual(CHANGED);
      expect(store.messages[0].body).toBe('');
    });

    it('refuses empty text with 400 even when the message is unknown, decided or deleted and has no attachment', async () => {
      expect((await patch({ body: '' }, '100000000000000099')).status).toBe(400);
      seed({}, 'ACCEPTED');
      expect((await patch({ body: ' ' })).status).toBe(400);
      store.messages = [];
      seed({ deletedAt: new Date() });
      expect((await patch({ body: '' })).status).toBe(400);
    });

    it('ignores attachments in an edit', async () => {
      seed();
      await patch({ body: 'New', attachments: [{ id: '100000000000000009', filename: 'a.png', size: 1, spoiler: false }] });
      expect(store.messages[0].attachments).toEqual([]);
    });

    it('changes and queues once for the same Idempotency-Key', async () => {
      seed();
      const key = `${DM}:edit:2026-10-12T16:05:00.000Z`;
      expect(await patch({ body: 'Edited' }, DM, key)).toEqual(CHANGED);
      expect(await patch({ body: 'Edited' }, DM, key)).toEqual(CHANGED);
      expect(store.enqueue).toHaveBeenCalledOnce();
    });
    it('stores the mentions sent with an edit, and clears them when an edit leaves them out', async () => {
      const mentions = { roles: { '100000000000000004': { name: 'Officer', color: 0 } } };
      seed({ mentions: { users: { '100000000000000001': { name: 'Old' } } } });
      expect(await patch({ body: 'Hello <@&100000000000000004>', mentions })).toEqual(CHANGED);
      expect(store.messages[0].mentions).toEqual(mentions);
      expect(await patch({ body: 'Hello, no tags' })).toEqual(CHANGED);
      expect(store.messages[0].mentions).toBe(Prisma.DbNull);
    });

    it('leaves the mentions alone when the text is unchanged', async () => {
      const mentions = { users: { '100000000000000001': { name: 'Thrall' } } };
      seed({ mentions });
      expect(await patch({ body: 'Hello', mentions: { users: { '100000000000000001': { name: 'Renamed' } } } })).toEqual(UNCHANGED);
      expect(await patch({ body: 'Hello' })).toEqual(UNCHANGED);
      expect(store.messages[0].mentions).toEqual(mentions);
    });

    it('refuses malformed mentions with 400 and changes nothing', async () => {
      seed();
      const many = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`1000000000000001${String(i).padStart(2, '0')}`, { name: 'x', color: 0 }]));
      for (const mentions of [{ channels: { general: { name: 'general' } } }, { users: { '100000000000000001': { name: 'a'.repeat(101) } } }, { roles: { '100000000000000004': { name: 'Officer', color: -1 } } }, { roles: many }, null]) {
        expect(await patch({ body: 'Edited', mentions })).toEqual({ status: 400, body: { reason: 'invalid', error: expect.any(String) } });
      }
      expect(store.messages[0]).toMatchObject({ body: 'Hello', editedAt: null });
      expect(store.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('DELETE', () => {
    it('marks a pending message deleted, keeps the text and queues one copy', async () => {
      seed();
      expect(await del()).toEqual(CHANGED);
      expect(store.messages[0]).toMatchObject({ body: 'Hello', deletedAt: expect.any(Date) });
      expect(store.enqueue).toHaveBeenCalledExactlyOnceWith(...copyJob);
    });

    it('does nothing for an unknown id, a decided application or an already-deleted message', async () => {
      expect(await del('100000000000000099')).toEqual(UNCHANGED);
      seed({}, 'DECLINED');
      expect(await del()).toEqual(UNCHANGED);
      store.messages = [];
      seed({ deletedAt: new Date() });
      expect(await del()).toEqual(UNCHANGED);
      expect(store.enqueue).not.toHaveBeenCalled();
    });

    it('ignores an edit after the delete', async () => {
      seed();
      await del();
      store.enqueue.mockClear();
      expect(await patch({ body: 'Late' })).toEqual(UNCHANGED);
      expect(store.messages[0].body).toBe('Hello');
      expect(store.enqueue).not.toHaveBeenCalled();
    });
  });
});
