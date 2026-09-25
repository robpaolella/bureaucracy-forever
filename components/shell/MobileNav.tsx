'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, CountBadge } from '@/components/ui';
import { DISCORD_INVITE_URL, LOGIN_URL, LOGOUT_URL } from '@/lib/config';
import { MEMBER_LINKS, OFFICER_LINKS, PUBLIC_LINKS } from '@/lib/nav';
import type { Session } from '@/lib/session';
import { NavLink } from './NavLink';
import { Wordmark } from './Wordmark';

const HEADING = 'px-3 py-1.5 text-label font-semibold uppercase';

function Divider() {
  return <div className="mx-3 my-2.5 h-px bg-line" aria-hidden />;
}

/**
 * Mobile header controls and the full-screen drawer. The drawer is a native <dialog>
 * so it traps focus and closes on Escape; navigation closes it too.
 */
export function MobileNav({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const officer = session?.role === 'officer';

  return (
    <div className="flex items-center gap-2">
      <ButtonLink href={DISCORD_INVITE_URL} size="sm" className="px-3 text-xs">
        Discord
      </ButtonLink>
      <Button
        variant="secondary"
        iconOnly
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="border-line bg-transparent"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="stroke-fg" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M2 5h14M2 9h14M2 13h14" />
        </svg>
      </Button>

      <dialog
        ref={ref}
        aria-label="Site menu"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-ink-900 p-0 text-fg"
      >
        <div className="flex h-[60px] items-center justify-between border-b border-line px-4">
          <Wordmark size="mobile" />
          <Button variant="secondary" iconOnly aria-label="Close menu" onClick={close} className="border-line bg-transparent">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-fg" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </Button>
        </div>

        <nav className="flex flex-col gap-0.5 px-2 py-3" aria-label="Site">
          {PUBLIC_LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} variant="drawer" onNavigate={close}>
              {l.label}
            </NavLink>
          ))}

          {session && (
            <>
              <Divider />
              <div className={`${HEADING} text-fg-3`}>Members</div>
              <NavLink href={MEMBER_LINKS.availability.href} variant="drawer" onNavigate={close} className="flex items-center justify-between">
                {MEMBER_LINKS.availability.label}
                {!session.availabilitySubmitted && <span className="text-label normal-case tracking-normal text-warn">Not submitted</span>}
              </NavLink>
              <NavLink href={MEMBER_LINKS.roster.href} variant="drawer" onNavigate={close}>
                {MEMBER_LINKS.roster.label}
              </NavLink>
              <NavLink href={MEMBER_LINKS.calendar.href} variant="drawer" onNavigate={close}>
                {MEMBER_LINKS.calendar.label}
              </NavLink>
            </>
          )}

          {officer && (
            <>
              <Divider />
              <div className={`${HEADING} text-sand`}>Officers</div>
              <NavLink href={OFFICER_LINKS.applications.href} variant="drawer" onNavigate={close} className="flex items-center justify-between">
                {OFFICER_LINKS.applications.label}
                {session.pendingApplications > 0 && <CountBadge className="h-5 min-w-5">{session.pendingApplications}</CountBadge>}
              </NavLink>
              <NavLink href={OFFICER_LINKS.heatmap.href} variant="drawer" onNavigate={close}>
                {OFFICER_LINKS.heatmap.label}
              </NavLink>
              <NavLink href={OFFICER_LINKS.schedule.href} variant="drawer" onNavigate={close}>
                {OFFICER_LINKS.schedule.label}
              </NavLink>
              <NavLink href={OFFICER_LINKS.needs.href} variant="drawer" onNavigate={close}>
                {OFFICER_LINKS.needs.label}
              </NavLink>
            </>
          )}

          <Divider />
          <div className="flex flex-col gap-2.5 px-3 pt-1">
            {session ? (
              <ButtonLink href={LOGOUT_URL} variant="secondary" size="sm" onClick={close}>
                Log out
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href={LOGIN_URL} variant="secondary" size="sm" onClick={close}>
                  Log in with Discord
                </ButtonLink>
                <ButtonLink href={DISCORD_INVITE_URL} size="sm" onClick={close}>
                  Join Discord
                </ButtonLink>
              </>
            )}
          </div>
        </nav>
      </dialog>
    </div>
  );
}
