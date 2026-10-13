// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplyButton, ApplyModalProvider } from './ApplyModal';

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/(site)/apply/actions', () => ({ checkApplyGate: async () => ({ kind: 'form', name: 'redtape' }) }));
vi.mock('@/app/(site)/recruitment/actions', () => ({ submitApplication: vi.fn() }));
vi.mock('@/components/shell/SiteSessionProvider', () => ({ useSiteSession: () => ({ session: null }) }));
vi.mock('next/image', () => ({ default: () => null }));

// Runs after React's handlers: records nothing, only keeps happy-dom from really fetching the page.
let handled = false;
const stopNavigation = (e: Event) => {
  handled = e.defaultPrevented;
  e.preventDefault();
};
let root: Root, host: HTMLDivElement;
const page = () => (
  <ApplyModalProvider>
    <ApplyButton path="raider">Apply</ApplyButton>
    <section id="expectations" />
  </ApplyModalProvider>
);
beforeEach(() => {
  vi.useFakeTimers();
  nav.pathname = '/';
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  document.addEventListener('click', stopNavigation);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  document.removeEventListener('click', stopNavigation);
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const click = (el: Element) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
const open = async () => {
  await act(async () => root.render(page()));
  await click(host.querySelector('a')!);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
};
const dialog = () => host.querySelector('dialog')!;
const expectations = () => dialog().querySelector<HTMLAnchorElement>('a[href="/recruitment#expectations"]')!;

describe('Apply window tickbox link', () => {
  it('on another page, opens the expectations in a new tab and leaves the window and answers alone', async () => {
    await open();
    const first = () => dialog().querySelector<HTMLInputElement>('input[name="firstName"]')!;
    await act(async () => { first().value = 'Redtape'; });
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    await act(async () => { expectations().dispatchEvent(ev); });
    expect(handled).toBe(false); // left to the browser
    expect(expectations().target).toBe('_blank');
    expect(dialog().open).toBe(true);
    expect(first().value).toBe('Redtape');
  });

  it('on the Recruitment page, closes the window, scrolls to the expectations and keeps the answers', async () => {
    nav.pathname = '/recruitment';
    await open();
    const first = () => dialog().querySelector<HTMLInputElement>('input[name="firstName"]')!;
    await act(async () => { first().value = 'Redtape'; });
    const scroll = vi.fn();
    document.getElementById('expectations')!.scrollIntoView = scroll;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    await act(async () => { expectations().dispatchEvent(ev); });
    expect(handled).toBe(true);
    expect(dialog().open).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(scroll).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe('#expectations');
    await click(host.querySelector('a')!);
    expect(first().value).toBe('Redtape');
  });
});
