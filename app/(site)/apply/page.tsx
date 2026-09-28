import type { Metadata } from 'next';
import { ApplicationForm } from '@/components/recruitment/ApplicationForm';
import { StatusPage } from '@/components/site/StatusPage';
import { ButtonLink } from '@/components/ui';
import { DISCORD_INVITE_URL, LOGIN_URL } from '@/lib/config';
import { applyGate } from '@/lib/apply-gate';
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
 * invite instead of the form. `?path=raider|social` preselects the path in the form. Apply
 * buttons around the site open the same form in a modal (ApplyModal); this page is where
 * they lead without JavaScript, and where the bot's links land.
 */
export default async function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  const path = one((await searchParams).path) === 'social' ? 'social' : 'raider';
  const back = `/apply?path=${path}`;
  const gate = await applyGate();

  if (gate.kind === 'signin') {
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

  if (gate.kind === 'join') {
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
      <ApplicationForm discordHandle={gate.name} initialPath={path} />
    </div>
  );
}
