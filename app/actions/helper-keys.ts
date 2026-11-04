'use server';

import { revalidatePath } from 'next/cache';
import { createHelperKey, revokeHelperKey } from '@/lib/helper-keys';
import { lootEnabled } from '@/lib/flags';
import { getSession } from '@/lib/session';

export type CreateKeyResult = { ok: true; key: string; name: string } | { ok: false; error: string };
export type RevokeKeyResult = { ok: true } | { ok: false; error: string };

/** With loot off the page is a 404, so its actions answer the same way. */
async function officerSession() {
  return lootEnabled() ? await getSession() : null;
}

/** Make a helper key for the signed-in officer. The plain key is in this answer once and is never stored. */
export async function createHelperKeyAction(name: string): Promise<CreateKeyResult> {
  const result = await createHelperKey(await officerSession(), name);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath('/officers/addon');
  return { ok: true, key: result.key, name: result.name };
}

/** Revoke one of the signed-in officer's own keys. Someone else's key reads as not found. */
export async function revokeHelperKeyAction(keyId: string): Promise<RevokeKeyResult> {
  // Server actions take whatever the network sends: an object here would become a Prisma filter matching every key.
  if (typeof keyId !== 'string' || !keyId) return { ok: false, error: 'That key wasn’t found. It may already be revoked.' };
  const result = await revokeHelperKey(await officerSession(), keyId);
  revalidatePath('/officers/addon');
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
