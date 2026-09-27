import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApplicationForm } from '@/components/recruitment/ApplicationForm';
import { StatusPage } from '@/components/site/StatusPage';
import { ButtonLink } from '@/components/ui';
import { DISCORD_INVITE_URL, LOGIN_URL } from '@/lib/config';
import { isGuildMember } from '@/lib/guild-check';
import { getDevStubSession, getSession } from '@/lib/session';
import { APPLY_GATE } from '@/content/recruitment';

export const metadata: Metadata = {
  title: 'Apply',
  description: 'Apply to Bureaucracy as a raider or a social member.',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * SYNC-SPEC §9.1: the form, alone, behind a Discord sign-in. Not in the server yet → the
 * invite instead of the form. `?path=raider|social` preselects the path in the form.
 */
export default async function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  const path = one((await searchParams).path) === 'social' ? 'social' : 'raider';
  const back = `/apply?path=${path}`;
  const session = await getSession();

  if (!session) {
    return (
      <StatusPage
        eyebrow={APPLY_GATE.eyebrow}
        title={APPLY_GATE.signInTitle}
        body={APPLY_GATE.signInBody}
        actions={
          <>
            <ButtonLink href={`${LOGIN_URL}?back=${encodeURIComponent(back)}`}>{APPLY_GATE.signIn}</ButtonLink>
            <ButtonLink href={DISCORD_INVITE_URL} variant="secondary">
              {APPLY_GATE.join}
            </ButtonLink>
          </>
        }
      />
    );
  }

  // The dev stub is not a Discord account; when the session IS the stub, treat it as a member
  // so the form can be worked on. A Discord error fails open: the action re-checks nothing,
  // but the applicant is signed in and officers see the account either way.
  const stub = await getDevStubSession();
  const lookup = stub && stub.discordId === session.discordId ? { kind: 'member' as const } : await isGuildMember(session.discordId);
  if (lookup.kind === 'absent') {
    return (
      <StatusPage
        eyebrow={APPLY_GATE.eyebrow}
        title={APPLY_GATE.joinTitle}
        body={APPLY_GATE.joinBody}
        actions={
          <>
            <ButtonLink href={DISCORD_INVITE_URL}>{APPLY_GATE.join}</ButtonLink>
            <ButtonLink href={back} variant="secondary">
              {APPLY_GATE.retry}
            </ButtonLink>
          </>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pb-20 pt-8 md:px-12 md:pt-11">
      <Suspense fallback={null}>
        <ApplicationForm discordHandle={session.name} />
      </Suspense>
    </div>
  );
}
