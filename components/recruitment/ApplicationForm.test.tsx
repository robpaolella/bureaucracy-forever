// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORM } from '@/content/recruitment';
import { ApplicationForm } from './ApplicationForm';

vi.mock('@/app/(site)/recruitment/actions', () => ({ submitApplication: vi.fn() }));
vi.mock('@/components/shell/SiteSessionProvider', () => ({ useSiteSession: () => ({ session: null }) }));

// Runs after React's handlers: records nothing, only keeps happy-dom from really fetching the page.
const stopNavigation = (e: Event) => {
  if ((e.target as Element).closest('a')) e.preventDefault();
};
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  document.addEventListener('click', stopNavigation);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  document.removeEventListener('click', stopNavigation);
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const link = () => host.querySelector<HTMLAnchorElement>('a[href="/recruitment#expectations"]');

describe('ApplicationForm tickbox', () => {
  it('links "raider expectations" to the Recruitment page and opens it in a new tab', async () => {
    await act(async () => root.render(<ApplicationForm />));
    expect(link()?.textContent).toBe(FORM.expectationsLink);
    expect(link()?.target).toBe('_blank');
    expect(link()?.rel).toContain('noopener');
    expect(host.textContent).toContain('I have read the raider expectations.');
  });

  it('lets the Apply window take over the click', async () => {
    const onClick = vi.fn();
    await act(async () => root.render(<ApplicationForm onExpectationsClick={onClick} />));
    await act(async () => link()!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not touch typed answers when the link is followed in a new tab', async () => {
    await act(async () => root.render(<ApplicationForm />));
    const input = host.querySelector<HTMLInputElement>('input[name="firstName"]')!;
    input.value = 'Redtape';
    await act(async () => link()!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    expect(host.querySelector<HTMLInputElement>('input[name="firstName"]')!.value).toBe('Redtape');
  });

  it('gives the expectations link its own 44px target without moving the label text', async () => {
    await act(async () => root.render(<ApplicationForm />));
    // 20px line + 12px above and below; the negative margin keeps the line height unchanged.
    expect(link()?.classList.contains('inline-block')).toBe(true);
    expect(link()?.classList.contains('py-3')).toBe(true);
    expect(link()?.classList.contains('-my-3')).toBe(true);
  });

  it('ticks the agreement from the label text', async () => {
    await act(async () => root.render(<ApplicationForm />));
    const box = host.querySelector<HTMLInputElement>('input[name="agree"]')!;
    expect(box.checked).toBe(false);
    // happy-dom ticks the box on a link click, which real browsers don't; that is checked in the browser.
    await act(async () => box.closest('label')!.firstElementChild!.nextElementSibling!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    expect(box.checked).toBe(true);
  });
});
