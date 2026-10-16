import 'server-only';

import type { InterviewGate } from '@/components/interview/state';
import type { ApplyGate } from '@/components/recruitment/form-state';
import { isGuildMember } from '@/lib/guild-check';
import { applicantInterview } from '@/lib/interviews';
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

/**
 * The /apply/interview gate and loader. It reads only the signed-in account's own latest
 * interview, so nothing a visitor sends can select another person's; any role may open it
 * (applicants are usually Discord Guests, site role `social`). Signed out reads nothing.
 */
export async function interviewGate(): Promise<InterviewGate> {
  const session = await getSession();
  if (!session) return { kind: 'signin' };
  const view = await applicantInterview(session.discordId);
  if (!view) return { kind: 'nothing' };
  const { status, requestedAt, slots, proposedStart, bookedStart } = view;
  return { kind: 'interview', interview: { status, requestedAt, slots, proposedStart, bookedStart }, name: session.name };
}
