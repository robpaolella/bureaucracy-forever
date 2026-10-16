import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: null as { discordId: string; name: string; role: string } | null, applicantInterview: vi.fn(), answerProposal: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/interviews', () => ({ applicantInterview: mocks.applicantInterview, answerProposal: mocks.answerProposal }));

import { answerShownProposal } from './actions';

const SHOWN = '2026-10-18T02:00:00.000Z';
const mine = { id: 'iv-mine', status: 'PROPOSED', proposedStart: SHOWN };

beforeEach(() => {
  mocks.session = { discordId: '1', name: 'Quillfeather', role: 'social' };
  mocks.applicantInterview.mockReset().mockResolvedValue(mine);
  mocks.answerProposal.mockReset().mockResolvedValue({ ok: true, interview: {} });
});

describe('answerShownProposal', () => {
  it.each(['accept', 'decline'] as const)('answers %s for the session’s own interview, found from the session', async (answer) => {
    expect(await answerShownProposal(answer, SHOWN)).toBe('answered');
    expect(mocks.applicantInterview).toHaveBeenCalledExactlyOnceWith('1');
    expect(mocks.answerProposal).toHaveBeenCalledExactlyOnceWith('iv-mine', '1', answer);
  });

  it('reads and writes nothing when signed out', async () => {
    mocks.session = null;
    expect(await answerShownProposal('accept', SHOWN)).toBe('signin');
    expect(mocks.applicantInterview).not.toHaveBeenCalled();
    expect(mocks.answerProposal).not.toHaveBeenCalled();
  });

  it('can only answer the signed-in account’s interview: nothing the page sends names one', async () => {
    mocks.session = { discordId: '2', name: 'Redtape', role: 'member' };
    mocks.applicantInterview.mockResolvedValue({ id: 'iv-redtape', status: 'PROPOSED', proposedStart: SHOWN });
    await answerShownProposal('accept', SHOWN);
    expect(mocks.applicantInterview).toHaveBeenCalledExactlyOnceWith('2');
    expect(mocks.answerProposal).toHaveBeenCalledExactlyOnceWith('iv-redtape', '2', 'accept');
  });

  it.each([
    ['another proposed time', { ...mine, proposedStart: '2026-10-19T02:00:00.000Z' }],
    ['a booking', { ...mine, status: 'BOOKED' }],
    ['a cancellation', { ...mine, status: 'CANCELLED' }],
    ['a closed interview', { ...mine, status: 'CLOSED' }],
    ['no interview', null],
  ])('treats %s as stale and changes nothing', async (_, view) => {
    mocks.applicantInterview.mockResolvedValue(view);
    expect(await answerShownProposal('accept', SHOWN)).toBe('stale');
    expect(mocks.answerProposal).not.toHaveBeenCalled();
  });

  it('passes on a refusal to accept under 15 minutes', async () => {
    mocks.answerProposal.mockResolvedValue({ ok: false, status: 409, reason: 'too_soon', error: 'That time starts in less than 15 minutes.' });
    expect(await answerShownProposal('accept', SHOWN)).toBe('too_soon');
  });

  it('reports a race lost to an officer or Discord as stale', async () => {
    mocks.answerProposal.mockResolvedValue({ ok: false, status: 409, reason: 'wrong_status', error: 'This interview is already booked.' });
    expect(await answerShownProposal('decline', SHOWN)).toBe('stale');
  });
});
