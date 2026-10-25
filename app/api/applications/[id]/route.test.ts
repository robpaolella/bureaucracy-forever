import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  application: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { upsert: vi.fn() }, character: { updateMany: vi.fn() },
  interview: { findFirst: vi.fn(), updateMany: vi.fn() },
  enqueue: vi.fn(), session: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: { ...mocks, $transaction: async (fn: (tx: typeof mocks) => unknown) => fn(mocks) } }));
vi.mock('@/lib/outbox', () => ({ enqueue: mocks.enqueue }));
vi.mock('@/lib/session', () => ({ getSession: mocks.session }));
import { PATCH } from './route';
import { DM_TEMPLATES } from '@/content/dm-templates';

const pending = { id: 'app', status: 'PENDING', path: 'RAIDER', character: 'Thrall', discordId: '1', discordName: 'thrall', switchedAt: null };
const patch = async (body: unknown) => {
  const res = await PATCH(new Request('http://localhost/api/applications/app', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'app' }) });
  return { status: res.status, body: await res.json() };
};
const written = () => mocks.application.updateMany.mock.calls[0]?.[0].data;
const payload = () => mocks.enqueue.mock.calls[0][1];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: 'officer', discordId: '2', name: 'Robert' });
  mocks.user.upsert.mockResolvedValue({ id: 'officer' });
  mocks.application.findUnique.mockResolvedValue(pending);
  mocks.application.updateMany.mockResolvedValue({ count: 1 });
  mocks.interview.findFirst.mockResolvedValue(null);
});

describe('PATCH /api/applications/:id choices', () => {
  it.each([
    [{ kind: 'standard' }, 'STANDARD', DM_TEMPLATES.declined('Thrall')],
    [{ kind: 'custom', text: 'Next tier!' }, 'CUSTOM', 'Next tier!'],
    [{ kind: 'none' }, 'NONE', null],
  ])('declines with %o', async (message, kind, text) => {
    expect(await patch({ status: 'declined', message })).toEqual({ status: 200, body: { id: 'app', status: 'declined' } });
    expect(written()).toMatchObject({ decisionMessageKind: kind, decisionMessageText: text, decisionMessageStatus: text === null ? null : 'QUEUED' });
    expect(payload()).toMatchObject({ dm: text, decisionId: written().decisionId, switched: false, message: { kind: kind.toLowerCase(), text } });
  });

  it('accepts as raider with the raider message', async () => {
    expect((await patch({ status: 'accepted', acceptAs: 'raider' })).status).toBe(200);
    expect(payload()).toMatchObject({ path: 'raider', switched: false, dm: DM_TEMPLATES.raider('Thrall') });
  });

  it('refuses Accept as raider on a social-path application', async () => {
    mocks.application.findUnique.mockResolvedValue({ ...pending, path: 'SOCIAL' });
    expect(await patch({ status: 'accepted', acceptAs: 'raider' })).toEqual({ status: 409, body: { error: 'This application was moved to the social path in the meantime. Check it and decide again.' } });
    expect(mocks.application.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'accepted', message: { kind: 'standard' } },
    { status: 'declined', acceptAs: 'social' },
    { status: 'declined', message: { kind: 'none', text: '' } },
    { status: 'declined', message: { kind: 'custom', text: 'x'.repeat(2001) } },
  ])('answers 400 for %o, before any state check', async (body) => {
    expect(await patch(body)).toEqual({ status: 400, body: { error: expect.any(String) } });
    expect(mocks.application.findUnique).not.toHaveBeenCalled();
  });
});
