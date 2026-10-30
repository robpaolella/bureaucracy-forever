import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/discord', () => ({ lookupGuildMember: vi.fn() }));

import { lookupGuildMember } from '@/lib/auth/discord';
import { isGuildMember } from './guild-check';

const lookup = vi.mocked(lookupGuildMember);
const member = { kind: 'member', member: { roles: [], nick: null } } as never;
const MIN = 60_000;

describe('isGuildMember', () => {
  beforeEach(() => lookup.mockReset());

  it('does not cache absent, so a fresh join is seen at once', async () => {
    lookup.mockResolvedValueOnce({ kind: 'absent' }).mockResolvedValueOnce(member);
    expect(await isGuildMember('100000000000000001', 0)).toEqual({ kind: 'absent' });
    expect(await isGuildMember('100000000000000001', MIN)).toEqual(member);
    expect(await isGuildMember('100000000000000001', 2 * MIN)).toEqual(member);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('serves a member from cache within ten minutes, then asks again', async () => {
    lookup.mockResolvedValue(member);
    await isGuildMember('100000000000000002', 0);
    await isGuildMember('100000000000000002', 9 * MIN);
    expect(lookup).toHaveBeenCalledTimes(1);
    await isGuildMember('100000000000000002', 10 * MIN);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('does not cache an error', async () => {
    lookup.mockResolvedValueOnce({ kind: 'error', status: 500 }).mockResolvedValueOnce(member);
    expect(await isGuildMember('100000000000000003', 0)).toEqual({ kind: 'error', status: 500 });
    expect(await isGuildMember('100000000000000003', MIN)).toEqual(member);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
