// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicantInterview } from './state';

const mocks = vi.hoisted(() => ({ answer: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/app/(squeeze)/apply/interview/actions', () => ({ answerShownProposal: mocks.answer }));

import { InterviewView } from './InterviewView';

const START = '2026-10-18T02:00:00.000Z';
const NOW = new Date('2026-10-15T22:15:00Z');
const TOO_SOON = 'This time starts in less than 15 minutes, so it can’t be accepted now. An officer will reach out to you directly to arrange another time.';
const STALE = 'This changed while the page was open.';
const OFFLINE = 'Couldn’t send your answer.';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  mocks.answer.mockReset().mockResolvedValue('answered');
  mocks.refresh.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const gate = (status: ApplicantInterview['status'], extra: Partial<ApplicantInterview> = {}) => ({
  kind: 'interview' as const,
  interview: { status, requestedAt: '2026-10-15T22:10:00.000Z', slots: [], proposedStart: null, bookedStart: null, ...extra },
  name: 'Quillfeather',
});
const render = (g = gate('PROPOSED', { proposedStart: START }), now = NOW) => act(async () => root.render(<InterviewView gate={g} now={now} />));
const byText = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const click = (el: HTMLElement) => act(async () => el.click());
const dialog = () => document.querySelector('dialog');

describe('answering a proposed time', () => {
  it('offers Accept and Decline on a proposal only', async () => {
    await render();
    expect(byText('Accept')).toBeTruthy();
    expect(byText('Decline')).toBeTruthy();
    for (const status of ['TIMES_RECEIVED', 'BOOKED', 'NO_TIME', 'CANCELLED', 'CLOSED', 'DONE'] as const) {
      await render(gate(status, { bookedStart: START }));
      expect(byText('Accept')).toBeUndefined();
      expect(byText('Decline')).toBeUndefined();
    }
  });

  it('accepts, then refreshes into the booked state', async () => {
    await render();
    await click(byText('Accept'));
    expect(mocks.answer).toHaveBeenCalledExactlyOnceWith('accept', START);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('declines only after the confirm', async () => {
    await render();
    await click(byText('Decline'));
    expect(mocks.answer).not.toHaveBeenCalled();
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent).toContain('Decline this time?');
    expect(dialog()?.textContent).toContain('The officers won’t offer another time here. An officer will reach out to you directly to arrange one.');
    await click(byText('Keep it'));
    expect(mocks.answer).not.toHaveBeenCalled();
    await click(byText('Decline'));
    await click(byText('Decline the time'));
    expect(mocks.answer).toHaveBeenCalledExactlyOnceWith('decline', START);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('disables the buttons while the answer is sending', async () => {
    let finish!: (outcome: string) => void;
    mocks.answer.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await render();
    await click(byText('Accept'));
    expect(byText('Accept').disabled).toBe(true);
    expect(byText('Decline').disabled).toBe(true);
    await click(byText('Accept'));
    expect(mocks.answer).toHaveBeenCalledOnce();
    await act(async () => finish('answered'));
  });

  it('under 15 minutes away, disables Accept with the reason and keeps Decline', async () => {
    await render(undefined, new Date(Date.parse(START) - 10 * 60_000));
    expect(host.textContent).toContain('starts in 10 minutes');
    const alert = host.querySelector('[role=alert]')!;
    expect(alert.textContent).toBe(TOO_SOON);
    expect(byText('Accept').getAttribute('aria-disabled')).toBe('true');
    expect(byText('Accept').getAttribute('aria-describedby')).toBe(alert.id);
    await click(byText('Accept'));
    expect(mocks.answer).not.toHaveBeenCalled();
    expect(byText('Decline').disabled).toBe(false);
  });

  it('shows the too-soon reason and disables Accept when the server refuses it', async () => {
    mocks.answer.mockResolvedValue('too_soon');
    await render();
    await click(byText('Accept'));
    expect(host.querySelector('[role=alert]')?.textContent).toBe(TOO_SOON);
    expect(byText('Accept').getAttribute('aria-disabled')).toBe('true');
  });

  it('shows the stale notice above the current state after an officer acted', async () => {
    mocks.answer.mockResolvedValue('stale');
    await render();
    expect(host.textContent).not.toContain(STALE);
    await click(byText('Accept'));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    // The refresh brings the booked state; the notice stays above it.
    await render(gate('BOOKED', { bookedStart: START }));
    expect(host.textContent).toContain(STALE);
    expect(host.textContent).toContain('Your interview is booked');
  });

  it('when the site can’t be reached, says so and leaves the buttons usable', async () => {
    mocks.answer.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await render();
    await click(byText('Accept'));
    expect(document.body.textContent).toContain(OFFLINE);
    expect(document.body.textContent).toContain('Check your connection and try again.');
    expect(byText('Accept').disabled).toBe(false);
    expect(byText('Decline').disabled).toBe(false);
    expect(mocks.refresh).not.toHaveBeenCalled();
    await click(byText('Retry'));
    expect(mocks.answer).toHaveBeenLastCalledWith('accept', START);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
