import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), applyNudgeAck: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { outboxJob: { findUnique: mocks.findUnique, update: mocks.update }, application: { updateMany: mocks.updateMany } } }));
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
