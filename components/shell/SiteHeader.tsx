import { ButtonLink, CountBadge } from '@/components/ui';
import { DISCORD_INVITE_URL, LOGIN_URL } from '@/lib/config';
import { MEMBER_LINKS, OFFICER_LINKS, PUBLIC_LINKS } from '@/lib/nav';
import type { Session } from '@/lib/session';
import { AvatarPill } from './AvatarPill';
import { MobileNav } from './MobileNav';
import { NavGroup } from './NavGroup';
import { NavLink } from './NavLink';
import { Wordmark } from './Wordmark';

/**
 * One header, three sessions. Public links never move; signing in adds a Members
 * group, officer rank adds an Officers group with the pending-application count.
 */
export function SiteHeader({ session }: { session: Session | null }) {
  const officer = session?.role === 'officer';

  return (
    <header className="border-b border-line-faint">
      {/* Desktop */}
      <div className="hidden h-[72px] items-center justify-between px-gutter md:flex">
        <div className="flex items-center gap-10">
          <Wordmark size="header" />
          <nav className="flex items-center gap-[26px]" aria-label="Site">
            {PUBLIC_LINKS.map((l) => (
              <NavLink key={l.href} href={l.href}>
                {l.label}
              </NavLink>
            ))}
            {session && (
              <NavGroup label="Members" width={260}>
                <NavLink href={MEMBER_LINKS.availability.href} variant="menu">
                  {MEMBER_LINKS.availability.label}
                  {!session.availabilitySubmitted && <span className="text-label normal-case tracking-normal text-warn">Not submitted</span>}
                </NavLink>
                <NavLink href={MEMBER_LINKS.roster.href} variant="menu">
                  {MEMBER_LINKS.roster.label}
                </NavLink>
                <NavLink href={MEMBER_LINKS.calendar.href} variant="menu">
                  {MEMBER_LINKS.calendar.label}
                </NavLink>
              </NavGroup>
            )}
            {officer && (
              <NavGroup
                label="Officers"
                tone="officer"
                width={288}
                badge={session.pendingApplications > 0 ? <CountBadge className="h-[19px] min-w-[19px] px-1.5">{session.pendingApplications}</CountBadge> : undefined}
              >
                <NavLink href={OFFICER_LINKS.applications.href} variant="menu">
                  {OFFICER_LINKS.applications.label}
                  {session.pendingApplications > 0 && <CountBadge className="h-[19px] min-w-[19px] px-1.5">{session.pendingApplications}</CountBadge>}
                </NavLink>
                <NavLink href={OFFICER_LINKS.heatmap.href} variant="menu">
                  {OFFICER_LINKS.heatmap.label}
                </NavLink>
                <NavLink href={OFFICER_LINKS.schedule.href} variant="menu">
                  {OFFICER_LINKS.schedule.label}
                </NavLink>
                <NavLink href={OFFICER_LINKS.needs.href} variant="menu">
                  {OFFICER_LINKS.needs.label}
                </NavLink>
              </NavGroup>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <ButtonLink href={DISCORD_INVITE_URL} variant="secondary" size="sm" className="bg-transparent px-[18px]">
                Join Discord
              </ButtonLink>
              <AvatarPill name={session.name} wowClass={session.wowClass} officer={officer} />
            </>
          ) : (
            <>
              <ButtonLink href={LOGIN_URL} variant="secondary" size="sm" className="bg-transparent">
                Log in with Discord
              </ButtonLink>
              <ButtonLink href={DISCORD_INVITE_URL} size="sm" className="px-[18px]">
                Join Discord
              </ButtonLink>
            </>
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="flex h-[60px] items-center justify-between px-4 md:hidden">
        <Wordmark size="mobile" />
        <MobileNav session={session} />
      </div>
    </header>
  );
}
