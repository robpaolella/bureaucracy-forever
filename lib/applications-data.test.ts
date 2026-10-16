import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), card: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { application: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/interviews', () => ({ interviewCard: mocks.card }));
import { loadApplication } from './applications-data';

const row = { id: 'app', path: 'RAIDER', status: 'PENDING', character: 'Thrall', class: 'SHAMAN', spec: 'Enhancement', discordId: 'd1', discordName: 'thrall', logsUrl: null, answers: {}, readAt: null, createdAt: new Date('2026-10-12T00:00:00Z'), decidedAt: null, decidedBy: null, discordThreadId: 'thread', notes: [] };
beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(row); });

describe('loadApplication interview', () => {
  it('has no interview card when the application never had one', async () => {
    mocks.card.mockResolvedValue(null);
    expect(await loadApplication('app')).toMatchObject({ id: 'app', interview: null });
  });

  it('carries the interview card for the application', async () => {
    const card = { attempt: 2, status: 'AWAITING_TIMES' };
    mocks.card.mockResolvedValue(card);
    expect(await loadApplication('app')).toMatchObject({ interview: card });
    expect(mocks.card).toHaveBeenCalledWith('app');
  });

  it('reads no interview for an unknown application', async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await loadApplication('nope')).toBeNull();
    expect(mocks.card).not.toHaveBeenCalled();
  });
});
