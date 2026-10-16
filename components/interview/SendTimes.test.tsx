// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicantInterview } from './state';

const mocks = vi.hoisted(() => ({ send: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/app/(squeeze)/apply/interview/actions', () => ({ sendTimes: mocks.send }));

import { InterviewView } from './InterviewView';

// The approved design's sample: requested Thu 15 Oct 3:10 PM guild time, viewed from New York.
const REQUESTED = '2026-10-15T22:10:00.000Z';
const NOW = new Date('2026-10-15T22:15:00Z');
const run = (from: string, hours: number) => Array.from({ length: hours * 2 }, (_, i) => new Date(Date.parse(from) + i * 30 * 60_000).toISOString());
// Thu 10 PM–12 AM, Sat 1–4 PM, Mon 9 PM–12 AM, Wed 12–2 AM EDT: 10 hours on 4 guild days.
const SENT = [...run('2026-10-16T02:00:00Z', 2), ...run('2026-10-17T17:00:00Z', 3), ...run('2026-10-20T01:00:00Z', 3), ...run('2026-10-21T04:00:00Z', 2)];
const STALE = 'This changed while the page was open.';
const OFFLINE = 'Couldn’t send your times. Check your connection and try again; your picks are still here.';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  localStorage.setItem('bureaucracy.viewer-timezone', 'America/New_York');
  mocks.send.mockReset().mockResolvedValue({ kind: 'sent' });
  mocks.refresh.mockReset();
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

const gate = (status: ApplicantInterview['status'], extra: Partial<ApplicantInterview> = {}) => ({
  kind: 'interview' as const,
  interview: { status, requestedAt: REQUESTED, slots: [], proposedStart: null, bookedStart: null, ...extra },
  name: 'Quillfeather',
});
const render = (g: ReturnType<typeof gate>) => act(async () => root.render(<InterviewView gate={g} now={NOW} />));
const buttons = () => [...host.querySelectorAll('button')];
const byText = (text: string) => buttons().find((b) => b.textContent?.trim() === text)!;
const byLabel = (start: string) => buttons().find((b) => b.getAttribute('aria-label')?.startsWith(start))!;
const hourButtons = () => buttons().filter((b) => b.hasAttribute('aria-pressed') && /^\d+:\d\d [AP]M$/.test(b.textContent ?? ''));
const click = (el: HTMLElement) => act(async () => el.click());
const footer = () => host.querySelector('[role=status], [role=alert]')!;
const notice = () => [...host.querySelectorAll('[role=status]')].find((el) => el.textContent === STALE);

/** Five hours on two guild days: Thu 15's four, and Sat 17's first (12:00 AM EDT, Fri 9:00 PM guild time). */
async function pickEnough() {
  await click(byText('Pick all'));
  await click(byLabel('Saturday 17 Oct'));
  await click(hourButtons()[0]);
}

describe('sending times', () => {
  it('sends the picked half-hour starts and the viewer’s zone, naming only what the page showed, then refreshes', async () => {
    await render(gate('AWAITING_TIMES'));
    await pickEnough();
    await click(byText('Send my times'));
    expect(mocks.send).toHaveBeenCalledOnce();
    const [picks, zone, shown] = mocks.send.mock.calls[0];
    expect(picks).toEqual(['2026-10-16T00:30:00.000Z', ...run('2026-10-16T01:00:00Z', 3), ...run('2026-10-17T04:00:00Z', 1)]);
    expect(zone).toBe('America/New_York');
    expect(shown).toEqual({ requestedAt: REQUESTED, slots: [] });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(notice()).toBeUndefined();
  });

  it('keeps the picks and offers Try again when the site can’t be reached', async () => {
    mocks.send.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await render(gate('AWAITING_TIMES'));
    await pickEnough();
    await click(byText('Send my times'));
    expect(footer().getAttribute('role')).toBe('alert');
    expect(footer().textContent).toBe(OFFLINE);
    expect(byText('Send my times')).toBeUndefined();
    expect(hourButtons()[0].getAttribute('aria-pressed')).toBe('true');
    expect(mocks.refresh).not.toHaveBeenCalled();
    await click(byText('Try again'));
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[1]).toEqual(mocks.send.mock.calls[0]);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('shows the server’s words when it refuses the times, until the picks change', async () => {
    const error = 'Pick at least 5 one-hour blocks on 2 or more different days. You need 1 more one-hour block.';
    mocks.send.mockResolvedValueOnce({ kind: 'refused', error });
    await render(gate('AWAITING_TIMES'));
    await pickEnough();
    await click(byText('Send my times'));
    expect(footer().textContent).toBe(error);
    expect(footer().getAttribute('role')).toBe('alert');
    expect(mocks.refresh).not.toHaveBeenCalled();
    await click(hourButtons()[0]);
    expect(footer().textContent).toBe('4 of 5 hours picked · add 1 more, on another day');
  });

  it('shows where the interview stands, with the notice, when it changed while the page was open', async () => {
    mocks.send.mockResolvedValueOnce({ kind: 'stale' });
    await render(gate('AWAITING_TIMES'));
    await pickEnough();
    await click(byText('Send my times'));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    // The refresh brings the booking an officer made meanwhile.
    await render(gate('BOOKED', { bookedStart: '2026-10-18T02:00:00.000Z' }));
    expect(notice()).toBeDefined();
    expect(host.querySelector('h1')!.textContent).toBe('Your interview is booked');
    expect(document.activeElement).toBe(host.querySelector('h1'));
  });
});

describe('changing sent times', () => {
  it('reopens the picker on the sent times, with Update closed until they change', async () => {
    await render(gate('TIMES_RECEIVED', { slots: SENT }));
    await click(byText('Change my times'));
    expect(host.querySelector('h1')!.textContent).toBe('Change your times');
    expect(document.activeElement).toBe(host.querySelector('h1'));
    expect(hourButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'true']);
    expect(footer().textContent).toBe('10 hours picked on 4 days · no changes yet');
    expect((byText('Update my times') as HTMLButtonElement).disabled).toBe(true);
    await click(hourButtons()[1]);
    expect(footer().textContent).toBe('11 hours picked on 4 days · changes not sent');
    expect((byText('Update my times') as HTMLButtonElement).disabled).toBe(false);
    await click(hourButtons()[1]);
    expect(footer().textContent).toBe('10 hours picked on 4 days · no changes yet');
  });

  it('applies the minimum to a change', async () => {
    await render(gate('TIMES_RECEIVED', { slots: SENT.slice(0, 10) }));
    await click(byText('Change my times'));
    // 5 hours on 2 days; take one away.
    await click(hourButtons()[2]);
    expect(footer().textContent).toBe('4 of 5 hours picked · add 1 more');
    expect((byText('Update my times') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Cancel returns to the sent times unchanged, sending nothing', async () => {
    await render(gate('TIMES_RECEIVED', { slots: SENT }));
    await click(byText('Change my times'));
    await click(hourButtons()[1]);
    await click(byText('Cancel'));
    expect(host.querySelector('h1')!.textContent).toBe('Your times are with the officers');
    expect(document.activeElement).toBe(byText('Change my times'));
    expect(host.textContent).toContain('Your times · 10 hours');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('Update sends the new times against the ones it opened with, and closes the picker', async () => {
    await render(gate('TIMES_RECEIVED', { slots: SENT }));
    await click(byText('Change my times'));
    await click(hourButtons()[1]);
    await click(byText('Update my times'));
    const [picks, , shown] = mocks.send.mock.calls[0];
    expect(picks).toHaveLength(SENT.length + 2);
    expect(shown).toEqual({ requestedAt: REQUESTED, slots: SENT });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(host.querySelector('h1')!.textContent).toBe('Your times are with the officers');
  });

  it('shows the times sent elsewhere meanwhile with the notice, never overwriting them', async () => {
    mocks.send.mockResolvedValueOnce({ kind: 'stale' });
    await render(gate('TIMES_RECEIVED', { slots: SENT }));
    await click(byText('Change my times'));
    await click(hourButtons()[1]);
    await click(byText('Update my times'));
    await render(gate('TIMES_RECEIVED', { slots: SENT.slice(0, 10) }));
    expect(notice()).toBeDefined();
    expect(host.textContent).toContain('Your times · 5 hours');
    // Changing again starts afresh, without the old notice.
    await click(byText('Change my times'));
    await click(byText('Cancel'));
    expect(notice()).toBeUndefined();
  });

  it('keeps the changes and offers Try again when the site can’t be reached', async () => {
    mocks.send.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await render(gate('TIMES_RECEIVED', { slots: SENT }));
    await click(byText('Change my times'));
    await click(hourButtons()[1]);
    await click(byText('Update my times'));
    expect(footer().textContent).toBe(OFFLINE);
    expect(hourButtons()[1].getAttribute('aria-pressed')).toBe('true');
    expect(byText('Try again')).toBeDefined();
    expect(byText('Cancel')).toBeDefined();
    // Back to the sent times: nothing to send, so the footer says so rather than offering Try again.
    await click(hourButtons()[1]);
    expect(footer().textContent).toBe('10 hours picked on 4 days · no changes yet');
    expect(byText('Try again')).toBeUndefined();
    expect((byText('Update my times') as HTMLButtonElement).disabled).toBe(true);
  });

  it('holds the picks while a send is on its way', async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.send.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    await render(gate('TIMES_RECEIVED', { slots: SENT }));
    await click(byText('Change my times'));
    await click(hourButtons()[1]);
    await click(byText('Update my times'));
    await click(hourButtons()[0]);
    expect(hourButtons()[0].getAttribute('aria-pressed')).toBe('false');
    await act(async () => finish({ kind: 'sent' }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
