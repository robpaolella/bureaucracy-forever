// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/ui';
import type { DetailRow } from '@/lib/raid-detail';
import { RosterLists } from './RosterLists';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('./AnswerFor', () => ({ AnswerFor: () => null }));

const row = (name: string, over: Partial<DetailRow> = {}): DetailRow => ({
  userId: name, name, character: `${name} Quill`, wowClass: 'mage', spec: 'Fire', role: 'ranged', level: null, standing: 'ROSTER',
  response: null, attended: null, source: 'web', reason: null, setBy: null, updatedAt: '2030-01-01T00:00:00Z', ...over,
});
const quiet = [row('Quiet'), row('Mum')];
const away = [row('Away', { response: 'absent', reason: 'Family dinner' })];
let root: Root, host: HTMLDivElement;

function render(over: Partial<React.ComponentProps<typeof RosterLists>> = {}) {
  return act(async () => root.render(
    <ToastHost>
      <RosterLists raidId="r" noResponse={quiet} absent={away} canAnswerFor={false} officer posted open {...over} />
    </ToastHost>,
  ));
}
const toggle = (label: string) => [...host.querySelectorAll('button[aria-expanded]')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
const nudge = () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Nudge in Discord');

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => act(async () => root.unmount()).then(() => host.remove()));

describe('RosterLists', () => {
  it('starts both lists closed, with their counts', async () => {
    await render();
    expect(toggle('No response').getAttribute('aria-expanded')).toBe('false');
    expect(toggle('No response').textContent).toContain('2');
    expect(toggle('Absent').textContent).toContain('1');
    expect(toggle('Absent').getAttribute('aria-expanded')).toBe('false');
    expect(host.textContent).not.toContain('Quiet Quill');
  });

  it('opens a list on click and shows the reason under an absent name', async () => {
    await render();
    await act(async () => toggle('Absent').click());
    expect(toggle('Absent').getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain('Away');
    expect(host.textContent).toContain('Away Quill · Mage');
    expect(host.textContent).toContain('“Family dinner”');
    expect(host.textContent).not.toContain('Quiet Quill');
    await act(async () => toggle('No response').click());
    expect(host.textContent).toContain('Quiet Quill · Mage');
    expect(host.textContent).toContain('Mum Quill · Mage');
    await act(async () => toggle('No response').click());
    expect(toggle('No response').getAttribute('aria-expanded')).toBe('false');
    expect(host.textContent).not.toContain('Quiet Quill');
  });

  it('says so when a list is empty', async () => {
    await render({ noResponse: [], absent: [] });
    expect(host.textContent).toContain('Everyone on the roster has answered.');
    expect(host.textContent).toContain('Nobody has declined.');
    expect(nudge()).toBeUndefined();
  });

  it('shows Nudge in Discord to officers on an open, posted raid, even while closed', async () => {
    await render();
    expect(nudge()?.disabled).toBe(false);
  });

  it('disables Nudge when the raid is not posted', async () => {
    await render({ posted: false });
    expect(nudge()?.disabled).toBe(true);
  });

  it('hides Nudge from members and on a raid that is not open', async () => {
    await render({ officer: false });
    expect(nudge()).toBeUndefined();
    await render({ open: false });
    expect(nudge()).toBeUndefined();
  });
});

describe('RosterLists level text', () => {
  it('shows a level only when it is known and under 60', async () => {
    await render({ noResponse: [row('Low', { level: 52 }), row('Full', { level: 60 }), row('Unknown', { level: null }), row('Edge', { level: 59 })], absent: [] });
    await act(async () => toggle('No response').click());
    expect(host.textContent).toContain('Low Quill · Mage · Level 52');
    expect(host.textContent).toContain('Edge Quill · Mage · Level 59');
    expect(host.textContent).not.toContain('Level 60');
    expect(host.textContent).not.toContain('Level unknown');
    expect(host.textContent).toContain('Full Quill · Mage');
  });
});
