import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), applyNudgeAck: vi.fn(), msgFind: vi.fn(), msgUpdate: vi.fn(), appUpdate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { outboxJob: { findUnique: mocks.findUnique, update: mocks.update }, application: { updateMany: mocks.updateMany, update: mocks.appUpdate }, applicantMessage: { findUnique: mocks.msgFind, update: mocks.msgUpdate } } }));
vi.mock('@/lib/application-reminders', () => ({ applyNudgeAck: mocks.applyNudgeAck }));
import { ackJob } from './outbox';

const job = (payload: Record<string, unknown>) => ({ id: 'j1', type: 'application.nudge', payload, attempts: 0, status: 'RUNNING' });
beforeEach(() => { vi.clearAllMocks(); mocks.applyNudgeAck.mockResolvedValue('reminder recorded'); });

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
