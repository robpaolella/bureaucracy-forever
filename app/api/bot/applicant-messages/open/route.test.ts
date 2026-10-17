import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ apps: [] as unknown[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: { application: { findMany: async ({ where }: { where: { status: string } }) => (store.apps as { status: string }[]).filter((a) => a.status === where.status) } },
}));
import { GET } from './route';

const created = new Date('2026-10-12T15:30:00Z');
const app = (over: Record<string, unknown> = {}) => ({ id: 'a1', status: 'PENDING', discordId: '100000000000000001', createdAt: created, reopenedAt: null, messages: [], ...over });
const call = (secret: string | null = 'test-secret') =>
  GET(new Request('https://example.test/api/bot/applicant-messages/open', { headers: secret ? { authorization: `Bearer ${secret}` } : {} }));

describe('GET /api/bot/applicant-messages/open', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.apps = [];
  });

  it('refuses a request without the bot secret', async () => {
    expect((await call(null)).status).toBe(401);
  });

  it('lists pending applications only, with the latest stored DM', async () => {
    store.apps = [app({ messages: [{ dmMessageId: '999' }] }), app({ id: 'a2', status: 'ACCEPTED' }), app({ id: 'a3', discordId: '100000000000000003' })];
    expect(await (await call()).json()).toEqual({
      open: [
        { applicationId: 'a1', applicantDiscordId: '100000000000000001', since: '2026-10-12T15:30:00.000Z', afterDmMessageId: '999' },
        { applicationId: 'a3', applicantDiscordId: '100000000000000003', since: '2026-10-12T15:30:00.000Z', afterDmMessageId: null },
      ],
    });
  });

  it('uses the reopen time as since after a reopen', async () => {
    store.apps = [app({ reopenedAt: new Date('2026-10-13T11:00:00Z') })];
    expect((await (await call()).json()).open[0].since).toBe('2026-10-13T11:00:00.000Z');
  });
});
