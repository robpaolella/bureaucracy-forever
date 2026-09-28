import 'server-only';

import type { ApplyGate } from '@/components/recruitment/form-state';
import { isGuildMember } from '@/lib/guild-check';
import { getDevStubSession, getSession } from '@/lib/session';

/**
 * The /apply gate, shared by the page and the apply modal. The dev stub is not a Discord
 * account; when the session IS the stub, treat it as a member so the form can be worked
 * on. A Discord error fails open: the applicant is signed in and officers see the account
 * either way.
 */
export async function applyGate(): Promise<ApplyGate> {
  const session = await getSession();
  if (!session) return { kind: 'signin' };
  const stub = await getDevStubSession();
  const lookup = stub && stub.discordId === session.discordId ? { kind: 'member' as const } : await isGuildMember(session.discordId);
  if (lookup.kind === 'absent') return { kind: 'join' };
  return { kind: 'form', name: session.name };
}
