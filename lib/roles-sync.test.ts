import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ userUpdate: vi.fn(), rank: 'TRIAL' }));

vi.mock('@/lib/db', () => {
  const tx = { user: { update: calls.userUpdate }, character: { updateMany: vi.fn() }, outboxJob: { create: vi.fn(async () => ({ id: 'j' })) } };
  return {
    db: {
      user: { findUnique: async () => ({ discordId: '100000000000000003', rank: calls.rank }) },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { setRankFromWeb } from './roles-sync';

describe('setRankFromWeb', () => {
  beforeEach(() => {
    calls.userUpdate.mockReset();
  });

  it('clears the trial clock, the nudge and any extension on leaving Trial', async () => {
    calls.rank = 'TRIAL';
    expect(await setRankFromWeb('u', 'RAIDER')).toBe('changed');
    expect(calls.userUpdate).toHaveBeenCalledWith({ where: { id: 'u' }, data: { rank: 'RAIDER', trialStartedAt: null, trialNudgedAt: null, trialCheckInAt: null } });
  });

  it('starts a fresh trial with no extension on entering Trial', async () => {
    calls.rank = 'SOCIAL';
    expect(await setRankFromWeb('u', 'TRIAL')).toBe('changed');
    const data = calls.userUpdate.mock.calls[0][0].data;
    expect(data.trialStartedAt).toBeInstanceOf(Date);
    expect(data).toMatchObject({ rank: 'TRIAL', trialNudgedAt: null, trialCheckInAt: null });
  });
});
