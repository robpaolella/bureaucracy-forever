import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ current: null as { discordId: string; name: string } | null, stub: null as { discordId: string } | null }));
const guild = vi.hoisted(() => ({ lookup: vi.fn() }));

vi.mock('@/lib/session', () => ({
  getSession: async () => session.current,
  getDevStubSession: async () => session.stub,
}));
vi.mock('@/lib/guild-check', () => ({ isGuildMember: guild.lookup }));

import { applyGate } from './apply-gate';

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
