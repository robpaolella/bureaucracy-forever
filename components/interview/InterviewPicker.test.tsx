// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewPicker } from './InterviewPicker';

// The approved design's sample: requested Thu 15 Oct 3:10 PM guild time, viewed from New York.
const REQUESTED = '2026-10-15T22:10:00.000Z';
const NOW = '2026-10-15T22:15:00.000Z';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  localStorage.setItem('bureaucracy.viewer-timezone', 'America/New_York');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const render = (initial: string[] = []) => act(async () => root.render(<InterviewPicker requestedAt={REQUESTED} now={NOW} name="Quillfeather" initial={initial} />));
const buttons = (within: ParentNode = host) => [...within.querySelectorAll('button')];
const byText = (text: string, within: ParentNode = host) => buttons(within).find((b) => b.textContent?.trim() === text)!;
const byLabel = (start: string) => buttons().find((b) => b.getAttribute('aria-label')?.startsWith(start))!;
const hourButtons = () => buttons().filter((b) => b.hasAttribute('aria-pressed') && /^\d+:\d\d [AP]M$/.test(b.textContent ?? ''));
const click = (el: HTMLElement) => act(async () => el.click());
const status = () => host.querySelector('[role=status]')!.textContent;

describe('InterviewPicker', () => {
  it('offers the first day’s bookable hours with the edge hour first, named in both zones', async () => {
    await render();
    const first = hourButtons()[0];
    expect(first.textContent).toBe('8:30 PM');
    expect(first.getAttribute('aria-label')).toBe('Could start any time 8:30 – 9:00 PM EDT, 5:30 – 6:00 PM guild time (PDT)');
    expect(hourButtons().map((b) => b.textContent)).toEqual(['8:30 PM', '9:00 PM', '10:00 PM', '11:00 PM']);
    expect(status()).toBe('Nothing picked yet · pick at least 5 hours on 2 or more days');
  });

  it('toggles an hour as a button that keeps its element, and reports the shortfall', async () => {
    await render();
    const nine = hourButtons()[1];
    nine.focus();
    await click(nine);
    expect(nine.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(nine);
    expect(hourButtons()[1]).toBe(nine);
    expect(status()).toBe('1 of 5 hours picked · add 4 more, on another day');
    await click(nine);
    expect(nine.getAttribute('aria-pressed')).toBe('false');
  });

  it('holds both half-hour starts of a picked hour, and only one at the window edge', async () => {
    await render();
    await click(hourButtons()[0]); // the edge hour: 8:30 PM only
    await click(hourButtons()[1]); // 9:00 PM: both starts
    // Both blocks count once each: two hours picked, though three starts are held.
    expect(status()).toBe('2 of 5 hours picked · add 3 more, on another day');
  });

  it('keeps Send disabled until 5 hours on 2 guild days, then opens it without sending anything', async () => {
    await render();
    await click(byText('Pick all')); // four hours on Thu 15
    expect(status()).toBe('4 of 5 hours picked · add 1 more, on another day');
    expect((byText('Send my times') as HTMLButtonElement).disabled).toBe(true);
    await click(byLabel('Saturday 17 Oct'));
    await click(hourButtons()[0]);
    expect(status()).toBe('5 hours picked on 2 days · not sent yet');
    expect((byText('Send my times') as HTMLButtonElement).disabled).toBe(false);
    expect(byLabel('Saturday 17 Oct, 1 picked').getAttribute('aria-pressed')).toBe('true');
  });

  it('asks before Clear all clears, and Keep them leaves the picks', async () => {
    await render();
    await click(byText('Pick all'));
    expect(byText('Clear this day')).toBeDefined();
    await click(byText('Clear all'));
    const dialog = [...host.querySelectorAll('dialog')].find((d) => d.textContent?.includes('Clear all your times?'))!;
    expect(dialog.open).toBe(true);
    await click(byText('Keep them', dialog));
    expect(dialog.open).toBe(false);
    expect(status()).toBe('4 of 5 hours picked · add 1 more, on another day');
    await click(byText('Clear all'));
    await click(byText('Clear all', dialog));
    expect(status()).toBe('Nothing picked yet · pick at least 5 hours on 2 or more days');
    expect(host.textContent).not.toContain('Clear this day');
    expect(document.activeElement).toBe(byText('Pick all'));
  });

  it('switches to guild time with the same picks, naming each hour in both zones', async () => {
    await render();
    await click(hourButtons()[1]);
    await click(byText('Guild time'));
    expect(hourButtons().map((b) => b.textContent)).toEqual(['5:30 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM']);
    expect(hourButtons()[1].getAttribute('aria-pressed')).toBe('true');
    expect(hourButtons()[1].getAttribute('aria-label')).toBe('Could start any time 6:00 – 7:00 PM guild time (PDT), 9:00 – 10:00 PM EDT your time');
  });

  it('opens on the sent times it is given, dropping any the window no longer offers', async () => {
    await render(['2026-10-16T01:00:00.000Z', '2026-10-16T01:30:00.000Z', '2026-01-01T17:00:00.000Z']);
    expect(hourButtons()[1].getAttribute('aria-pressed')).toBe('true');
    expect(status()).toBe('1 of 5 hours picked · add 4 more, on another day');
  });

  it('says so when the window has no times left', async () => {
    await act(async () => root.render(<InterviewPicker requestedAt={REQUESTED} now="2026-11-20T00:00:00.000Z" name="Quillfeather" />));
    expect(host.textContent).toContain('There are no times left to pick.');
    expect(hourButtons()).toHaveLength(0);
  });
});
