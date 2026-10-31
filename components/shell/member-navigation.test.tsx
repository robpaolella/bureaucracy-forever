import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { MEMBER_LINKS } from '@/lib/nav';
const m = vi.hoisted(() => ({ session: null as null | { role: string; loot: boolean; name: string; pendingApplications: number; availabilitySubmitted: boolean } }));
vi.mock('./SiteSessionProvider', () => ({ useSiteSession: () => ({ session: m.session }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/app/actions/auth', () => ({ signOutAction: vi.fn() }));
import { SiteHeader } from './SiteHeader';
import { MobileNav } from './MobileNav';

const session = (role: string) => ({ role, loot: true, name: 'Sample', pendingApplications: 0, availabilitySubmitted: false });

it('shows a signed-in social no Members menu or link in either menu', () => {
  m.session = session('social');
  for (const Component of [SiteHeader, MobileNav]) {
    const html = renderToStaticMarkup(<Component />);
    expect(html).not.toContain('href="/members');
    expect(html).not.toContain('>Members<');
    expect(html).not.toContain('Not submitted');
  }
  // Still signed in: the header keeps their name, the drawer its Log out.
  expect(renderToStaticMarkup(<SiteHeader />)).toContain('Sample');
  expect(renderToStaticMarkup(<MobileNav />)).toContain('Log out');
});

it.each(['member', 'officer'])('keeps every Members link for a %s', (role) => {
  m.session = session(role);
  for (const Component of [SiteHeader, MobileNav]) {
    const html = renderToStaticMarkup(<Component />);
    expect(html).toContain('>Members<');
    for (const link of Object.values(MEMBER_LINKS)) expect(html).toContain(`href="${link.href}"`);
  }
});
