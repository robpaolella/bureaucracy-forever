import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  application: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn(), upsert: vi.fn() }, character: { updateMany: vi.fn() },
  interview: { findFirst: vi.fn(), updateMany: vi.fn() },
  enqueue: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: { ...mocks, $transaction: async (fn: (tx: typeof mocks) => unknown) => fn(mocks) } }));
vi.mock('@/lib/outbox', () => ({ enqueue: mocks.enqueue }));
import { POST } from './route';
import { DM_TEMPLATES } from '@/content/dm-templates';

const OFFICER = '100000000000000001';
const post = async (body: Record<string, unknown>) => {
  const res = await POST(
    new Request('https://example.test/api/bot/applications/app/decision', { method: 'POST', headers: { authorization: 'Bearer test-secret' }, body: JSON.stringify({ byDiscordId: OFFICER, ...body }) }),
    { params: Promise.resolve({ id: 'app' }) },
  );
  return { status: res.status, body: await res.json() };
};
const written = () => mocks.application.updateMany.mock.calls[0]?.[0].data;
const payload = () => mocks.enqueue.mock.calls[0][1];

beforeEach(() => {
  vi.resetAllMocks();
  process.env.BOT_SHARED_SECRET = 'test-secret';
  mocks.application.findUnique.mockResolvedValue({ id: 'app', status: 'PENDING', path: 'RAIDER', character: 'Thrall', discordId: '1', discordName: 'thrall', switchedAt: null });
  mocks.application.updateMany.mockResolvedValue({ count: 1 });
  mocks.user.findUnique.mockResolvedValue({ id: 'officer', discordName: 'Robert', role: 'OFFICER' });
  mocks.interview.findFirst.mockResolvedValue(null);
});

describe('POST /api/bot/applications/:id/decision choices', () => {
  it.each([
    [{ kind: 'standard' }, 'STANDARD', DM_TEMPLATES.declined('Thrall')],
    [{ kind: 'custom', text: ' Next tier! ' }, 'CUSTOM', 'Next tier!'],
    [{ kind: 'none' }, 'NONE', null],
  ])('declines with %o', async (message, kind, text) => {
    expect(await post({ status: 'DECLINED', message })).toEqual({ status: 200, body: { id: 'app', status: 'declined' } });
    expect(written()).toMatchObject({ decisionMessageKind: kind, decisionMessageText: text, decisionMessageStatus: text === null ? null : 'QUEUED' });
    expect(payload()).toMatchObject({ dm: text, decisionId: written().decisionId, switched: false, message: { kind: kind.toLowerCase(), text } });
  });

  it('accepts as social with a switch', async () => {
    expect((await post({ status: 'ACCEPTED', acceptAs: 'social' })).status).toBe(200);
    expect(payload()).toMatchObject({ path: 'social', switched: true, dm: DM_TEMPLATES.social('Thrall') });
  });

  it('refuses Accept as raider on a social-path application', async () => {
    mocks.application.findUnique.mockResolvedValue({ id: 'app', status: 'PENDING', path: 'SOCIAL', character: 'Thrall', discordId: '1', discordName: 'thrall', switchedAt: null });
    expect(await post({ status: 'ACCEPTED', acceptAs: 'raider' })).toEqual({ status: 409, body: { reason: 'This application was moved to the social path in the meantime. Check it and decide again.' } });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'ACCEPTED', message: { kind: 'none' } },
    { status: 'DECLINED', acceptAs: 'raider' },
    { status: 'DECLINED', message: null },
    { status: 'DECLINED', message: { kind: 'custom', text: '   ' } },
  ])('answers 400 invalid for %o, before any state check', async (body) => {
    mocks.application.findUnique.mockResolvedValue({ id: 'app', status: 'ACCEPTED' });
    expect(await post(body)).toEqual({ status: 400, body: { reason: 'invalid', error: expect.any(String) } });
    expect(mocks.application.findUnique).not.toHaveBeenCalled();
  });
});
