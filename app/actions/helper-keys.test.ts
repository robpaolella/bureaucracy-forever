import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  session: null as unknown,
  loot: true,
  create: vi.fn(),
  revoke: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidate }));
vi.mock('@/lib/session', () => ({ getSession: async () => m.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => m.loot }));
vi.mock('@/lib/helper-keys', () => ({ createHelperKey: m.create, revokeHelperKey: m.revoke }));

import { createHelperKeyAction, revokeHelperKeyAction } from './helper-keys';

const officer = { discordId: '1', role: 'officer' };

beforeEach(() => {
  vi.clearAllMocks();
  m.session = officer;
  m.loot = true;
});

describe('createHelperKeyAction', () => {
  it("makes the officer's key and refreshes the page", async () => {
    m.create.mockResolvedValue({ ok: true, key: 'bfh_x', id: 'k1', name: "Rob's PC", createdAt: new Date(), lastUsedAt: null });
    expect(await createHelperKeyAction("Rob's PC")).toEqual({ ok: true, key: 'bfh_x', name: "Rob's PC" });
    expect(m.create).toHaveBeenCalledWith(officer, "Rob's PC");
    expect(m.revalidate).toHaveBeenCalledWith('/officers/addon');
  });

  it('passes on the blank-name message', async () => {
    m.create.mockResolvedValue({ ok: false, status: 400, error: 'Give the key a name.' });
    expect(await createHelperKeyAction('  ')).toEqual({ ok: false, error: 'Give the key a name.' });
    expect(m.revalidate).not.toHaveBeenCalled();
  });

  it('hands a non-officer session to the key function, which refuses it', async () => {
    m.session = { discordId: '2', role: 'member' };
    m.create.mockResolvedValue({ ok: false, status: 403, error: 'Officers only.' });
    expect(await createHelperKeyAction('PC')).toEqual({ ok: false, error: 'Officers only.' });
    expect(m.create).toHaveBeenCalledWith(m.session, 'PC');
  });

  it('acts as signed out while loot is off', async () => {
    m.loot = false;
    m.create.mockResolvedValue({ ok: false, status: 401, error: 'Log in first.' });
    await createHelperKeyAction('PC');
    expect(m.create).toHaveBeenCalledWith(null, 'PC');
  });
});

describe('revokeHelperKeyAction', () => {
  it('revokes the key and refreshes the page', async () => {
    m.revoke.mockResolvedValue({ ok: true });
    expect(await revokeHelperKeyAction('k1')).toEqual({ ok: true });
    expect(m.revoke).toHaveBeenCalledWith(officer, 'k1');
    expect(m.revalidate).toHaveBeenCalledWith('/officers/addon');
  });

  it("refuses another officer's key as not found", async () => {
    m.revoke.mockResolvedValue({ ok: false, status: 404, error: 'That key wasn’t found. It may already be revoked.' });
    expect(await revokeHelperKeyAction('theirs')).toEqual({ ok: false, error: 'That key wasn’t found. It may already be revoked.' });
  });

  it('refuses an id that is not a plain string, without touching the keys', async () => {
    for (const bad of [{ not: '' }, '', null, 42]) expect(await revokeHelperKeyAction(bad as never)).toMatchObject({ ok: false });
    expect(m.revoke).not.toHaveBeenCalled();
  });

  it('refuses a non-officer', async () => {
    m.session = null;
    m.revoke.mockResolvedValue({ ok: false, status: 401, error: 'Log in first.' });
    expect((await revokeHelperKeyAction('k1')).ok).toBe(false);
    expect(m.revoke).toHaveBeenCalledWith(null, 'k1');
  });
});
