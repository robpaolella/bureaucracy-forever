// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewCard as Card } from '@/lib/interviews';
import { InterviewCard, timesByDay } from './InterviewCard';

vi.mock('server-only', () => ({}));
const zoneStore = vi.hoisted(() => ({ zone: 'America/New_York' as string | null }));
vi.mock('@/components/time/useViewerTimeZone', () => ({ useViewerTimeZone: () => (zoneStore.zone ? { zone: zoneStore.zone, source: 'detected' } : null) }));

// 2026-10-17 02:00Z = Fri 16 Oct 7:00 PM guild time, 10:00 PM New York.
const SLOT = '2026-10-17T02:00:00.000Z';
const base: Card = {
  attempt: 1, status: 'AWAITING_TIMES', endReason: null, requestedBy: 'Ledgerline', requestedAt: '2026-10-15T22:10:00.000Z', windowEnd: '2026-10-22T22:00:00.000Z',
  slots: [], timesUpdatedAt: null, proposedBy: null, proposedStart: null, bookedBy: null, bookedStart: null, endedBy: null, endedAt: null, earlier: null,
};
let root: Root, host: HTMLDivElement;
beforeEach(() => { zoneStore.zone = 'America/New_York'; vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const show = async (card: Partial<Card>, threadUrl: string | null = 'https://discord.com/channels/1/2') =>
  act(async () => root.render(<InterviewCard card={{ ...base, ...card }} applicant="quillfeather" threadUrl={threadUrl} />));
// What a reader sees: the guild-time popups are in the page but hidden until asked for.
const text = () => {
  const copy = host.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[role=tooltip]').forEach((el) => el.remove());
  return copy.textContent!.replace(/\u00a0/g, ' ');
};

describe('InterviewCard', () => {
  it('shows the pill word, the thread link and the Discord-only note, with no actions', async () => {
    await show({});
    expect(text()).toContain('Waiting for times');
    expect(host.querySelector('a')?.textContent).toBe('Open the thread ↗');
    expect(text()).toContain('Book, propose and cancel in the Discord thread.');
    expect(host.querySelectorAll('button').length).toBe(host.querySelectorAll('button[aria-label]').length); // only time buttons
  });

  it('omits the thread link when the application has no thread', async () => {
    await show({}, null);
    expect(host.querySelector('a')).toBeNull();
  });

  it('renders times in the viewer zone with guild time in the accessible name', async () => {
    await show({ status: 'BOOKED', bookedBy: 'Ledgerline', bookedStart: SLOT });
    const button = host.querySelector('button')!;
    expect(button.textContent).toContain('10:00 PM EDT');
    expect(button.getAttribute('aria-label')).toContain('7:00 PM guild time');
    expect(text()).toContain('Booked for Friday 16 Oct, 10:00 PM EDT by Ledgerline.');
  });

  it('shows the guild zone abbreviation before the viewer zone is known', async () => {
    zoneStore.zone = null;
    await show({ status: 'BOOKED', bookedBy: 'Ledgerline', bookedStart: SLOT });
    expect(text()).toContain('Friday 16 Oct, 7:00 PM PDT');
  });

  it('lists the applicant’s times by day for times received, proposed and no time found', async () => {
    const slots = [SLOT, '2026-10-17T02:30:00.000Z', '2026-10-17T03:00:00.000Z', '2026-10-17T17:00:00.000Z'];
    for (const status of ['TIMES_RECEIVED', 'PROPOSED', 'NO_TIME'] as const) {
      await show({ status, slots, timesUpdatedAt: '2026-10-16T13:12:00.000Z', proposedBy: 'Redtape', proposedStart: SLOT, endReason: 'DECLINED' });
      expect(host.querySelectorAll('li').length).toBe(2);
      expect(text()).toContain('Friday 16 Oct');
    }
    await show({ status: 'BOOKED', bookedStart: SLOT, slots });
    expect(host.querySelectorAll('li').length).toBe(0);
  });

  it('counts half-hours in the times-received line', async () => {
    await show({ status: 'TIMES_RECEIVED', slots: [SLOT, '2026-10-17T02:30:00.000Z'], timesUpdatedAt: '2026-10-16T13:12:00.000Z' });
    expect(text()).toContain('quillfeather sent 2 half-hours, last changed on Friday 16 Oct');
    expect(text()).toContain('Requested by Ledgerline.');
  });

  it('says who proposed and which time', async () => {
    await show({ status: 'PROPOSED', proposedBy: 'Redtape', proposedStart: SLOT, slots: [SLOT] });
    expect(text()).toContain('Redtape proposed Friday 16 Oct, 10:00 PM EDT. Waiting for quillfeather to accept or decline.');
  });

  it('names who cancelled, when, and the time it had been booked for', async () => {
    await show({ status: 'CANCELLED', endedBy: 'Redtape', endedAt: '2026-10-16T20:00:00.000Z', bookedStart: SLOT });
    expect(text()).toContain('Cancelled by Redtape on Friday 16 Oct. It had been booked for Friday 16 Oct, 10:00 PM EDT.');
  });

  it('drops the booked-for sentence when a cancel came before any booking', async () => {
    await show({ status: 'CANCELLED', endedBy: 'Redtape', endedAt: '2026-10-16T20:00:00.000Z' });
    expect(text()).toContain('Cancelled by Redtape on Friday 16 Oct.');
    expect(text()).not.toContain('booked for');
  });

  it('says how many half-hours a closed applicant had sent', async () => {
    await show({ status: 'CLOSED', slots: [SLOT, '2026-10-17T02:30:00.000Z', '2026-10-17T03:00:00.000Z'] });
    expect(text()).toContain('Closed when the application was decided. quillfeather had sent 3 half-hours.');
  });

  it('words the second interview, with the earlier outcome in the pill’s words', async () => {
    await show({ attempt: 2, earlier: { status: 'NO_TIME', at: '2026-10-10T19:00:00.000Z' } });
    expect(text()).toContain('Second interview, requested by Ledgerline on');
    expect(text()).toContain('Earlier interview: No time found, Saturday 10 Oct.');
  });

  it.each([['DONE', 'Done'], ['CANCELLED', 'Cancelled'], ['NO_TIME', 'No time found'], ['CLOSED', 'Closed']] as const)('names an earlier %s attempt with the pill’s capitalised word', async (status, word) => {
    await show({ attempt: 2, earlier: { status, at: '2026-10-10T19:00:00.000Z' } });
    expect(text()).toContain(`Earlier interview: ${word}, Saturday 10 Oct.`);
  });

  it('words each way an interview can end without a time', async () => {
    await show({ status: 'NO_TIME', endReason: 'EXPIRED' });
    expect(text()).toContain('quillfeather didn’t send times by');
    await show({ status: 'NO_TIME', endReason: 'PROPOSAL_LAPSED', proposedBy: 'Redtape', proposedStart: SLOT });
    expect(text()).toContain('quillfeather didn’t answer Redtape’s proposed time');
  });
});

describe('timesByDay', () => {
  it('joins consecutive half-hours and splits at the viewer’s midnight', () => {
    const days = timesByDay(['2026-10-17T03:30:00.000Z', '2026-10-17T04:00:00.000Z', '2026-10-17T04:30:00.000Z', '2026-10-17T06:00:00.000Z'], 'America/Los_Angeles');
    expect(days.map((d) => [d.day, d.ranges.map((r) => r.minutes)])).toEqual([['Friday 16 Oct', [90, 30]]]);
    const ny = timesByDay(['2026-10-17T03:30:00.000Z', '2026-10-17T04:00:00.000Z'], 'America/New_York');
    expect(ny).toHaveLength(2);
  });
});
