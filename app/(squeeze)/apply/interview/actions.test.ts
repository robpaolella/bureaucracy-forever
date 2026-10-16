import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: null as { discordId: string; name: string; role: string } | null, applicantInterview: vi.fn(), answerProposal: vi.fn(), submitTimes: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/interviews', () => ({ applicantInterview: mocks.applicantInterview, answerProposal: mocks.answerProposal, submitTimes: mocks.submitTimes }));

import { answerShownProposal, sendTimes } from './actions';

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

describe('sendTimes', () => {
  const REQUESTED = '2026-10-15T22:10:00.000Z';
  const SENT = ['2026-10-16T02:00:00.000Z', '2026-10-16T02:30:00.000Z'];
  const PICKS = ['2026-10-17T17:00:00.000Z', '2026-10-17T17:30:00.000Z'];
  const awaiting = { id: 'iv-mine', status: 'AWAITING_TIMES', requestedAt: REQUESTED, slots: [] as string[], timesRevision: 0 };
  const received = { ...awaiting, status: 'TIMES_RECEIVED', slots: SENT, timesRevision: 3 };
  const TOO_FEW = 'Pick at least 5 one-hour blocks on 2 or more different days. You need 4 more one-hour blocks.';

  beforeEach(() => {
    mocks.applicantInterview.mockResolvedValue(awaiting);
    mocks.submitTimes.mockReset().mockResolvedValue({ ok: true, interview: {} });
  });

  it('sends the times to the session’s own interview, found from the session', async () => {
    expect(await sendTimes(PICKS, 'America/New_York', { requestedAt: REQUESTED, slots: [] })).toEqual({ kind: 'sent' });
    expect(mocks.applicantInterview).toHaveBeenCalledExactlyOnceWith('1');
    expect(mocks.submitTimes).toHaveBeenCalledExactlyOnceWith('iv-mine', '1', PICKS, 'America/New_York', undefined, 0);
  });

  it('changes sent times when the page showed the ones still stored, in any order', async () => {
    mocks.applicantInterview.mockResolvedValue(received);
    expect(await sendTimes(PICKS, 'America/New_York', { requestedAt: REQUESTED, slots: [...SENT].reverse() })).toEqual({ kind: 'sent' });
    // The revision it checked goes with the write, so a save landing in between is refused.
    expect(mocks.submitTimes).toHaveBeenCalledExactlyOnceWith('iv-mine', '1', PICKS, 'America/New_York', undefined, 3);
  });

  it('reads and writes nothing when signed out', async () => {
    mocks.session = null;
    expect(await sendTimes(PICKS, 'America/New_York', { requestedAt: REQUESTED, slots: [] })).toEqual({ kind: 'signin' });
    expect(mocks.applicantInterview).not.toHaveBeenCalled();
    expect(mocks.submitTimes).not.toHaveBeenCalled();
  });

  it('ignores any interview or application id the request carries: only the session picks the interview', async () => {
    mocks.session = { discordId: '2', name: 'Redtape', role: 'member' };
    mocks.applicantInterview.mockResolvedValue({ ...awaiting, id: 'iv-redtape' });
    const forged = { requestedAt: REQUESTED, slots: [], interviewId: 'iv-mine', applicationId: 'app-mine', discordId: '1' };
    await (sendTimes as (...args: unknown[]) => Promise<unknown>)(PICKS, 'America/New_York', forged, 'iv-mine');
    expect(mocks.applicantInterview).toHaveBeenCalledExactlyOnceWith('2');
    expect(mocks.submitTimes).toHaveBeenCalledExactlyOnceWith('iv-redtape', '2', PICKS, 'America/New_York', undefined, 0);
  });

  it.each([
    ['a booking', { ...received, status: 'BOOKED' }],
    ['a proposal', { ...received, status: 'PROPOSED' }],
    ['a cancellation', { ...received, status: 'CANCELLED' }],
    ['a closed interview', { ...received, status: 'CLOSED' }],
    ['no interview', null],
    ['a newer attempt than the page showed', { ...awaiting, requestedAt: '2026-10-20T18:00:00.000Z' }],
    ['times changed in another tab', { ...received, slots: PICKS }],
    ['times sent in another tab', received],
  ])('treats %s as stale and changes nothing', async (_, view) => {
    mocks.applicantInterview.mockResolvedValue(view);
    expect(await sendTimes(PICKS, 'America/New_York', { requestedAt: REQUESTED, slots: [] })).toEqual({ kind: 'stale' });
    expect(mocks.submitTimes).not.toHaveBeenCalled();
  });

  it('treats a malformed record of what the page showed as stale', async () => {
    expect(await (sendTimes as (...args: unknown[]) => Promise<unknown>)(PICKS, 'America/New_York', undefined)).toEqual({ kind: 'stale' });
    expect(await (sendTimes as (...args: unknown[]) => Promise<unknown>)(PICKS, 'America/New_York', { requestedAt: REQUESTED, slots: 'all' })).toEqual({ kind: 'stale' });
    expect(mocks.submitTimes).not.toHaveBeenCalled();
  });

  it.each([
    ['a first send', awaiting, []],
    ['a change', received, SENT],
  ])('passes on the server’s refusal below the minimum for %s', async (_, view, shown) => {
    mocks.applicantInterview.mockResolvedValue(view);
    mocks.submitTimes.mockResolvedValue({ ok: false, status: 400, reason: 'too_few_times', error: TOO_FEW });
    expect(await sendTimes(PICKS, 'America/New_York', { requestedAt: REQUESTED, slots: shown })).toEqual({ kind: 'refused', error: TOO_FEW });
  });

  it.each(['out_of_range', 'invalid'])('passes on a %s refusal in its own words', async (reason) => {
    mocks.submitTimes.mockResolvedValue({ ok: false, status: 400, reason, error: 'Pick half-hour start times within the next week.' });
    expect(await sendTimes(PICKS, 'America/New_York', { requestedAt: REQUESTED, slots: [] })).toEqual({ kind: 'refused', error: 'Pick half-hour start times within the next week.' });
  });

  it('reports a race lost to an officer, Discord or another tab as stale', async () => {
    mocks.submitTimes.mockResolvedValue({ ok: false, status: 409, reason: 'wrong_status', error: 'This interview is already booked.' });
    expect(await sendTimes(PICKS, 'America/New_York', { requestedAt: REQUESTED, slots: [] })).toEqual({ kind: 'stale' });
  });
});
