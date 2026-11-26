// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/ui';
import type { DetailRow } from '@/lib/raid-detail';
import type { RaidCard } from '@/lib/raids';
import { BenchCard } from './BenchCard';
import { ManageSignupsProvider } from './ManageSignups';
import { OfficerActions } from './OfficerActions';
import { RosterByRole } from './RosterByRole';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('./AnswerFor', () => ({ AnswerFor: ({ name }: { name: string }) => <select aria-label={`Answer for ${name}`} /> }));

const row = (name: string, over: Partial<DetailRow> = {}): DetailRow => ({
  userId: name, name, character: `${name} Quill`, wowClass: 'mage', spec: 'Fire', role: 'ranged', level: null, standing: 'ROSTER',
  response: 'accept', attended: null, source: 'web', reason: null, setBy: null, updatedAt: '2030-01-01T00:00:00Z', ...over,
});
const raid = { id: 'r', name: 'Onyxia', startsAt: '2030-01-01T20:00:00Z', durationMin: 180, notes: null, cancelled: false, requirements: { tank: 2, healer: 8, dps: 25 }, counts: { tank: 0, healer: 0, melee: 0, ranged: 0 }, mine: null, locksAt: null } as unknown as RaidCard;

let root: Root, host: HTMLDivElement;

function Page({ officer = true, past = false, cancelled = false }: { officer?: boolean; past?: boolean; cancelled?: boolean }) {
  const live = officer && !past && !cancelled;
  return (
    <ToastHost>
      <ManageSignupsProvider>
        {officer && <OfficerActions raid={{ ...raid, cancelled }} members={[{ id: 'm', label: 'Mum' }]} past={past} threadUrl={null} fromSeries={false} template={null} templates={[]} lootOn={false} />}
        <RosterByRole raidId="r" rows={[row('Rostered'), row('Quiet', { response: null }), row('Away', { response: 'absent' })]} now="2030-01-02T00:00:00Z" canAnswerFor={live} showAttendance={past} officer={officer} posted open />
        <BenchCard raidId="r" rows={[row('Benched', { standing: 'BENCH' })]} officer={live} />
      </ManageSignupsProvider>
    </ToastHost>
  );
}

const render = (props: React.ComponentProps<typeof Page> = {}) => act(async () => root.render(<Page {...props} />));
const switches = () => [...host.querySelectorAll<HTMLButtonElement>('button[role="switch"]')];
const answers = () => host.querySelectorAll('select[aria-label^="Answer for"]');
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === label);
const openLists = () => act(async () => host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]').forEach((b) => b.click()));
const flip = () => act(async () => switches()[0].click());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('Manage sign-ups', () => {
  it('starts off: officers see the member view and Nudge in Discord, with no answer controls', async () => {
    await render();
    await openLists();
    expect(switches()[0].getAttribute('aria-checked')).toBe('false');
    expect(answers()).toHaveLength(0);
    expect(host.querySelector('form[aria-label="Answer for someone not listed"]')).toBeNull();
    expect(button('Move to roster')).toBeUndefined();
    expect(button('Nudge in Discord')).toBeDefined();
    expect(host.textContent).toContain('Accept');
  });

  it('on: the roster, both lists, the bench and Answer for someone appear', async () => {
    await render();
    await openLists();
    await flip();
    expect(switches().every((s) => s.getAttribute('aria-checked') === 'true')).toBe(true);
    expect([...answers()].map((a) => a.getAttribute('aria-label'))).toEqual(['Answer for Rostered', 'Answer for Quiet', 'Answer for Away', 'Answer for Benched']);
    expect(host.querySelector('form[aria-label="Answer for someone not listed"]')).not.toBeNull();
    expect(button('Move to roster')).toBeDefined();
    expect(button('Nudge in Discord')).toBeDefined();
  });

  it('turning it off again hides the controls; a fresh mount starts off', async () => {
    await render();
    await flip();
    await flip();
    expect(answers()).toHaveLength(0);
    await flip();
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(switches()[0].getAttribute('aria-checked')).toBe('false');
    expect(answers()).toHaveLength(0);
  });

  it('the phone button names the mode while it is on', async () => {
    await render();
    const phone = () => host.querySelector('button[aria-haspopup="dialog"]')!;
    expect(phone().textContent).toBe('Officer actions');
    await flip();
    expect(phone().textContent).toBe('Officer actions · Managing sign-ups');
  });

  it('focus stays on the switch when it changes', async () => {
    await render();
    const sw = switches()[0];
    sw.focus();
    expect(document.activeElement).toBe(sw);
    await flip();
    expect(document.activeElement).toBe(sw);
    expect(switches()[0]).toBe(sw);
  });

  it.each([['a past raid', { past: true }], ['a cancelled raid', { cancelled: true }]])('no switch on %s', async (_, props) => {
    await render(props);
    expect(switches()).toHaveLength(0);
    expect(answers()).toHaveLength(0);
  });

  it('a member never sees the switch or the controls', async () => {
    await render({ officer: false });
    expect(switches()).toHaveLength(0);
    expect(answers()).toHaveLength(0);
    expect(button('Move to roster')).toBeUndefined();
  });
});
