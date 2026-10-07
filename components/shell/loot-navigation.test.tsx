import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ session: null as null | { role: string; loot: boolean; name: string; pendingApplications: number; availabilitySubmitted: boolean } }));
vi.mock('./SiteSessionProvider', () => ({ useSiteSession: () => ({ session: m.session }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/members/loot' }));
vi.mock('@/app/actions/auth', () => ({ signOutAction: vi.fn() }));
import { SiteHeader } from './SiteHeader';
import { MobileNav } from './MobileNav';
it.each([null, 'social', 'member', 'officer'])('gates both menu links for %s with either flag state', (role) => {
  for (const loot of [false, true]) {
    m.session = role ? { role, loot, name: 'Sample', pendingApplications: 0, availabilitySubmitted: true } : null;
    for (const Component of [SiteHeader, MobileNav]) {
      const html = renderToStaticMarkup(<Component />);
      expect(html.includes('href="/members/loot"')).toBe(loot && (role === 'member' || role === 'officer'));
      if (html.includes('href="/members/loot"')) expect(html.indexOf('Raid calendar')).toBeLessThan(html.indexOf('Loot history'));
    }
  }
});
