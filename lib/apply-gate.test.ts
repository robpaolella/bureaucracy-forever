import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ current: null as { discordId: string; name: string; role?: string } | null, stub: null as { discordId: string } | null }));
const guild = vi.hoisted(() => ({ lookup: vi.fn() }));
const interviews = vi.hoisted(() => ({ applicantInterview: vi.fn() }));

vi.mock('@/lib/session', () => ({
  getSession: async () => session.current,
  getDevStubSession: async () => session.stub,
}));
vi.mock('@/lib/guild-check', () => ({ isGuildMember: guild.lookup }));
vi.mock('@/lib/interviews', () => interviews);

import { applyGate, interviewGate } from './apply-gate';

describe('applyGate', () => {
  beforeEach(() => {
    session.current = null;
    session.stub = null;
    guild.lookup.mockReset();
  });

  it('asks a signed-out visitor to sign in, without calling Discord', async () => {
    expect(await applyGate()).toEqual({ kind: 'signin' });
    expect(guild.lookup).not.toHaveBeenCalled();
  });

  it('sends a signed-in account that is not in the server to the invite', async () => {
    session.current = { discordId: '1', name: 'Redtape' };
    guild.lookup.mockResolvedValue({ kind: 'absent' });
    expect(await applyGate()).toEqual({ kind: 'join' });
  });

  it('shows the form to a member, and fails open when Discord errors', async () => {
    session.current = { discordId: '1', name: 'Redtape' };
    guild.lookup.mockResolvedValue({ kind: 'member' });
    expect(await applyGate()).toEqual({ kind: 'form', name: 'Redtape' });
    guild.lookup.mockResolvedValue({ kind: 'error' });
    expect(await applyGate()).toEqual({ kind: 'form', name: 'Redtape' });
  });

  it('treats the dev stub as a member without asking Discord', async () => {
    session.current = { discordId: 'stub', name: 'Ledgerline' };
    session.stub = { discordId: 'stub' };
    expect(await applyGate()).toEqual({ kind: 'form', name: 'Ledgerline' });
    expect(guild.lookup).not.toHaveBeenCalled();
  });
});

describe('interviewGate', () => {
  // The full read shape: officer and Discord message ids the page must never receive.
  const view = {
    id: 'iv1', applicationId: 'app1', attempt: 1, status: 'BOOKED', endReason: null,
    applicant: { discordId: '1', characterName: 'Quillfeather' }, threadId: 'thread-1', timeZone: 'America/New_York',
    timesRevision: 1, slots: ['2026-10-18T02:00:00.000Z'], requestedAt: '2026-10-15T22:10:00.000Z',
    requestedBy: { discordId: 'officer-1', name: 'Ledgerline' }, proposedStart: null, proposedBy: null,
    bookedStart: '2026-10-18T02:00:00.000Z', bookedBy: { discordId: 'officer-1', name: 'Ledgerline' }, endedAt: null,
    pageUrl: 'https://www.bureauguild.com/apply/interview', requestDmId: 'dm-1', timesMessageId: 'm-1',
    proposalMessageId: null, proposalDmId: null, bookedMessageId: 'm-2',
  };

  beforeEach(() => {
    session.current = null;
    interviews.applicantInterview.mockReset();
  });

  it('asks a signed-out visitor to sign in and reads no interview', async () => {
    expect(await interviewGate()).toEqual({ kind: 'signin' });
    expect(interviews.applicantInterview).not.toHaveBeenCalled();
  });

  it("reads only the signed-in account's own interview, a Guest (social) included, without asking Discord", async () => {
    session.current = { discordId: '1', name: 'Quillfeather', role: 'social' };
    interviews.applicantInterview.mockResolvedValue(view);
    expect(await interviewGate()).toEqual({
      kind: 'interview',
      interview: { status: 'BOOKED', slots: ['2026-10-18T02:00:00.000Z'], proposedStart: null, bookedStart: '2026-10-18T02:00:00.000Z' },
    });
    expect(interviews.applicantInterview).toHaveBeenCalledExactlyOnceWith('1');
    expect(guild.lookup).not.toHaveBeenCalled();
  });

  it('passes the page no officer, thread or message ids', async () => {
    session.current = { discordId: '1', name: 'Quillfeather', role: 'social' };
    interviews.applicantInterview.mockResolvedValue(view);
    const text = JSON.stringify(await interviewGate());
    for (const secret of ['officer-1', 'Ledgerline', 'thread-1', 'dm-1', 'm-1', 'm-2', 'iv1', 'app1']) expect(text).not.toContain(secret);
  });

  it('shows nothing to schedule when the account has no interview', async () => {
    session.current = { discordId: '2', name: 'Redtape', role: 'member' };
    interviews.applicantInterview.mockResolvedValue(null);
    expect(await interviewGate()).toEqual({ kind: 'nothing' });
    expect(interviews.applicantInterview).toHaveBeenCalledExactlyOnceWith('2');
  });
});
