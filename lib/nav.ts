/** Navigation structure from docs/02 § SiteHeader and docs/03 § Routes. */

export type NavItem = { href: string; label: string };

/**
 * Is `href` the current page? Nested routes count (/members/calendar/123 lights up
 * Raid calendar). An href with a query or hash is an action, never "current".
 */
export function isActive(pathname: string, href: string): boolean {
  if (href.includes('?') || href.includes('#')) return false;
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

/** Public links never move between session states. */
export const PUBLIC_LINKS: NavItem[] = [
  { href: '/about', label: 'About' },
  { href: '/schedule', label: 'Raiding' },
  { href: '/recruitment', label: 'Recruitment' },
  { href: '/loot', label: 'Loot rules' },
];

/** The footer repeats the public links. */
export const FOOTER_LINKS = PUBLIC_LINKS;

export const MEMBER_LINKS = {
  availability: { href: '/members/availability', label: 'My availability' },
  roster: { href: '/members/roster', label: 'Roster' },
  calendar: { href: '/members/calendar', label: 'Raid calendar' },
} satisfies Record<string, NavItem>;

export const OFFICER_LINKS = {
  applications: { href: '/officers/applications', label: 'Applications' },
  heatmap: { href: '/officers/availability', label: 'Availability' },
  roster: { href: '/officers/roster', label: 'Roster management' },
  raids: { href: '/officers/raids', label: 'Raid management' },
  needs: { href: '/officers/needs', label: 'Recruitment management' },
} satisfies Record<string, NavItem>;
