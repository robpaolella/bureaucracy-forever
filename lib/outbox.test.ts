import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), applyNudgeAck: vi.fn(), msgFind: vi.fn(), msgUpdate: vi.fn(), msgUpdateMany: vi.fn(), jobCreate: vi.fn(), appUpdate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => {
  const db = { outboxJob: { findUnique: mocks.findUnique, update: mocks.update, create: mocks.jobCreate }, application: { updateMany: mocks.updateMany, update: mocks.appUpdate }, applicantMessage: { findUnique: mocks.msgFind, update: mocks.msgUpdate, updateMany: mocks.msgUpdateMany } };
  return { db: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) } };
});
vi.mock('@/lib/application-reminders', () => ({ applyNudgeAck: mocks.applyNudgeAck }));
import { ackJob } from './outbox';

const job = (payload: Record<string, unknown>) => ({ id: 'j1', type: 'application.nudge', payload, attempts: 0, status: 'RUNNING' });
beforeEach(() => { vi.clearAllMocks(); mocks.applyNudgeAck.mockResolvedValue('reminder recorded'); mocks.jobCreate.mockResolvedValue({ id: 'j2' }); });

describe('ackJob for application.nudge', () => {
  it('applies a keyed job through the reminder rules', async () => {
    mocks.findUnique.mockResolvedValue(job({ applicationId: 'a1', key: 'k@2026-10-13' }));
    const result = { channelId: 'c', messageId: 'm' };
    expect(await ackJob('j1', { ok: true, result })).toEqual({ status: 'DONE', applied: 'reminder recorded' });
    expect(mocks.applyNudgeAck).toHaveBeenCalledWith('a1', 'k@2026-10-13', result);
  });

  it('acks a keyless job as before: done, nothing applied', async () => {
    mocks.findUnique.mockResolvedValue(job({ applicationId: 'a1', character: 'Thrall' }));
    expect(await ackJob('j1', { ok: true, result: { channelId: 'c', messageId: 'm' } })).toEqual({ status: 'DONE', applied: undefined });
    expect(mocks.applyNudgeAck).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe('ackJob for application.message.copy', () => {
  const copyJob = { id: 'j1', type: 'application.message.copy', payload: { applicationId: 'a1', messageId: 'm1' }, attempts: 0, status: 'RUNNING' };
  beforeEach(() => { mocks.findUnique.mockResolvedValue(copyJob); mocks.msgFind.mockResolvedValue({ applicationId: 'a1' }); });

  it('stores the copy ids without touching relayPingAt when not pinged', async () => {
    expect(await ackJob('j1', { ok: true, result: { channelId: 'c1', messageId: 'x1', pinged: false } })).toEqual({ status: 'DONE', applied: 'message copy stored' });
    expect(mocks.msgUpdate).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { copyChannelId: 'c1', copyMessageId: 'x1' } });
    expect(mocks.appUpdate).not.toHaveBeenCalled();
  });

  it('sets relayPingAt when pinged', async () => {
    await ackJob('j1', { ok: true, result: { channelId: 'c1', messageId: 'x1', pinged: true } });
    expect(mocks.appUpdate).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { relayPingAt: expect.any(Date) } });
  });

  it('stores nothing for a skip or ids that are not strings, and still completes the ack', async () => {
    for (const result of [{ skipped: 'thread closed' }, { channelId: 5, messageId: 'x1', pinged: true }, { channelId: 'c1', pinged: true }]) {
      expect(await ackJob('j1', { ok: true, result })).toEqual({ status: 'DONE', applied: undefined });
    }
    expect(mocks.msgUpdate).not.toHaveBeenCalled();
    expect(mocks.appUpdate).not.toHaveBeenCalled();
  });

  it('changes nothing when the message no longer exists', async () => {
    mocks.msgFind.mockResolvedValue(null);
    expect(await ackJob('j1', { ok: true, result: { channelId: 'c1', messageId: 'x1', pinged: true } })).toEqual({ status: 'DONE', applied: undefined });
    expect(mocks.msgUpdate).not.toHaveBeenCalled();
    expect(mocks.appUpdate).not.toHaveBeenCalled();
  });
});

describe('ackJob for application.message.send', () => {
  const sendJob = { id: 'j1', type: 'application.message.send', payload: { applicationId: 'a1', messageId: 'm1' }, attempts: 0, status: 'RUNNING' };
  const ids = { dmChannelId: '100000000000000002', dmMessageId: '100000000000000003' };
  const copy = { data: { type: 'application.message.copy', payload: { applicationId: 'a1', messageId: 'm1' } }, select: { id: true } };
  const onlyIfQueued = { id: 'm1', direction: 'TO_APPLICANT', status: 'QUEUED' };
  beforeEach(() => { mocks.findUnique.mockResolvedValue(sendJob); mocks.msgUpdateMany.mockResolvedValue({ count: 1 }); });

  it('sets each of the three statuses on a queued message and queues one copy', async () => {
    const cases: [Record<string, unknown>, Record<string, unknown>, string][] = [
      [ids, { status: 'SENT', ...ids }, 'message sent'],
      [{ dmDelivered: false }, { status: 'NOT_DELIVERED' }, 'message not_delivered'],
      [{ notSent: true }, { status: 'NOT_SENT' }, 'message not_sent'],
    ];
    for (const [result, data, applied] of cases) {
      vi.clearAllMocks();
      mocks.msgUpdateMany.mockResolvedValue({ count: 1 });
      mocks.jobCreate.mockResolvedValue({ id: 'j2' });
      expect(await ackJob('j1', { ok: true, result })).toEqual({ status: 'DONE', applied });
      expect(mocks.msgUpdateMany).toHaveBeenCalledExactlyOnceWith({ where: onlyIfQueued, data });
      expect(mocks.jobCreate).toHaveBeenCalledExactlyOnceWith(copy);
    }
  });

  it('changes nothing and queues no copy once the message has left QUEUED', async () => {
    mocks.msgUpdateMany.mockResolvedValue({ count: 0 });
    expect(await ackJob('j1', { ok: true, result: { notSent: true } })).toEqual({ status: 'DONE', applied: 'stale send result ignored' });
    expect(mocks.jobCreate).not.toHaveBeenCalled();
  });

  it('stores nothing for a skip or an unreadable result, and still completes the ack', async () => {
    for (const result of [{ skipped: 'SENT' }, {}, { dmChannelId: 'x' }]) {
      expect(await ackJob('j1', { ok: true, result })).toEqual({ status: 'DONE', applied: undefined });
    }
    expect(mocks.msgUpdateMany).not.toHaveBeenCalled();
    expect(mocks.jobCreate).not.toHaveBeenCalled();
  });

  it('a repeated ack of the done job changes nothing', async () => {
    mocks.findUnique.mockResolvedValue({ ...sendJob, status: 'DONE' });
    expect(await ackJob('j1', { ok: true, result: ids })).toEqual({ status: 'DONE' });
    expect(mocks.msgUpdateMany).not.toHaveBeenCalled();
  });
});

describe('ackJob for application.decide', () => {
  const decide = { id: 'j1', type: 'application.decide', payload: { applicationId: 'a1', decisionId: 'd1' }, attempts: 0, status: 'RUNNING' };
  beforeEach(() => { mocks.findUnique.mockResolvedValue(decide); mocks.updateMany.mockResolvedValue({ count: 1 }); });

  it.each([[true, 'SENT'], [false, 'NOT_DELIVERED'], [null, 'UNCONFIRMED']])('stores dmDelivered %s as %s, only for the current queued decision', async (dmDelivered, status) => {
    await ackJob('j1', { ok: true, result: { dmDelivered } });
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: 'a1', decisionId: 'd1', decisionMessageStatus: 'QUEUED' }, data: { decisionMessageStatus: status } });
  });

  it('reports a stale or repeated ack as ignored and still completes the job', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect(await ackJob('j1', { ok: true, result: { dmDelivered: true } })).toEqual({ status: 'DONE', applied: 'stale decision ack ignored' });
  });

  it.each([
    ['no decisionId', { applicationId: 'a1' }, { dmDelivered: true }],
    ['a result without dmDelivered', { applicationId: 'a1', decisionId: 'd1' }, {}],
    ['a non-boolean dmDelivered', { applicationId: 'a1', decisionId: 'd1' }, { dmDelivered: 'yes' }],
  ])('changes nothing for %s', async (_n, payload, result) => {
    mocks.findUnique.mockResolvedValue({ ...decide, payload });
    expect(await ackJob('j1', { ok: true, result })).toEqual({ status: 'DONE', applied: undefined });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
