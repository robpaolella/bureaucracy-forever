import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  application: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { upsert: vi.fn() }, character: { updateMany: vi.fn() },
  interview: { findFirst: vi.fn(), updateMany: vi.fn() },
  enqueue: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: { ...mocks, $transaction: async (fn: (tx: typeof mocks) => unknown) => fn(mocks) } }));
vi.mock('@/lib/outbox', () => ({ enqueue: mocks.enqueue }));
import { decideApplication, reopenApplication } from './decisions';

const app = { id: 'app', status: 'PENDING', path: 'RAIDER', character: 'Thrall', discordId: 'applicant', discordName: 'thrall' };
const jobs = () => mocks.enqueue.mock.calls.map(([type, payload]) => [type, payload]);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.application.findUnique.mockResolvedValue(app);
  mocks.application.updateMany.mockResolvedValue({ count: 1 });
  mocks.interview.findFirst.mockResolvedValue({ id: 'int' });
  mocks.interview.updateMany.mockResolvedValue({ count: 1 });
});

describe('deciding an application with an interview in progress', () => {
  it.each([['web', 'accepted'], ['discord', 'declined']] as const)('closes it from %s, with the decision', async (source, status) => {
    expect(await decideApplication('app', status, { userId: 'officer', name: 'Robert', source })).toBe('decided');
    expect(mocks.interview.findFirst).toHaveBeenCalledWith({ where: { activeKey: 'app' }, select: { id: true } });
    expect(mocks.interview.updateMany).toHaveBeenCalledWith({
      where: { id: 'int', status: { in: ['AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'BOOKED'] } },
      data: { status: 'CLOSED', activeKey: null, endedAt: expect.any(Date), endedById: 'officer' },
    });
    expect(jobs().map(([type]) => type)).toEqual(['application.decide', 'interview.ended']);
    expect(jobs()[1][1]).toEqual({ applicationId: 'app', interviewId: 'int', outcome: 'closed' });
    // Both writes share the decision's transaction.
    expect(mocks.enqueue.mock.calls[1][2]).toBe(mocks);
  });

  it('closes nothing when no interview is active', async () => {
    mocks.interview.findFirst.mockResolvedValue(null);
    expect(await decideApplication('app', 'declined', { userId: 'officer', name: 'Robert', source: 'web' })).toBe('decided');
    expect(mocks.interview.updateMany).not.toHaveBeenCalled();
    expect(jobs().map(([type]) => type)).toEqual(['application.decide']);
  });

  it('leaves the interview alone when another officer decided first', async () => {
    mocks.application.updateMany.mockResolvedValue({ count: 0 });
    expect(await decideApplication('app', 'accepted', { userId: 'officer', name: 'Robert', source: 'discord' })).toBe('conflict');
    expect(mocks.interview.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});

describe('reopening an application', () => {
  it('reopens without touching the retired nudgedAt', async () => {
    mocks.application.findUnique.mockResolvedValue({ id: 'app', status: 'DECLINED' });
    expect(await reopenApplication('app', { userId: 'officer', name: 'Robert', source: 'web' })).toBe('decided');
    const [{ data }] = mocks.application.updateMany.mock.calls[0];
    expect(data).toEqual({ status: 'PENDING', decidedAt: null, decidedByUserId: null, reopenedAt: expect.any(Date) });
    expect(jobs()).toEqual([['application.reopen', { applicationId: 'app', reopenedBy: 'Robert', source: 'web' }]]);
  });
});
