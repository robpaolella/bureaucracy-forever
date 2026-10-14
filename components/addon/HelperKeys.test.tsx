// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ create: vi.fn(), revoke: vi.fn(), toast: vi.fn() }));
vi.mock('@/app/actions/helper-keys', () => ({ createHelperKeyAction: m.create, revokeHelperKeyAction: m.revoke }));
vi.mock('@/components/ui', async (original) => ({ ...(await original<typeof import('@/components/ui')>()), useToast: () => m.toast }));
vi.mock('@/components/time/useViewerTimeZone', () => ({ useViewerTimeZone: () => null }));

import { HelperKeys, type KeyView } from './HelperKeys';

const key = (id: string, name: string, lastUsedAt: string | null = null): KeyView => ({ id, name, createdAt: '2026-10-13T20:00:00.000Z', lastUsedAt });

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = (keys: KeyView[]) => act(async () => root.render(<HelperKeys keys={keys} nameMax={40} />));
const type = async (value: string) => {
  const input = host.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const submit = () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === label)!;

describe('HelperKeys', () => {
  it('says so when there are no keys', async () => {
    await render([]);
    expect(host.textContent).toContain('No helper keys yet. Create one for each computer you raid on.');
  });

  it('lists names with Never used for an unused key', async () => {
    await render([key('1', 'Rob’s PC'), key('2', 'MacBook', '2026-10-14T01:00:00.000Z')]);
    const rows = host.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Never used');
    expect(rows[1].textContent).not.toContain('Never used');
  });

  it('shows a blank-name error and keeps the field', async () => {
    m.create.mockResolvedValue({ ok: false, error: 'Give the key a name.' });
    await render([]);
    await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Give the key a name.');
    expect(host.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the new key once, and Done clears it', async () => {
    m.create.mockResolvedValue({ ok: true, key: 'bfh_secret', name: 'Rob’s PC' });
    await render([]);
    await type('Rob’s PC');
    await submit();
    expect(m.create).toHaveBeenCalledWith('Rob’s PC');
    expect(host.textContent).toContain('bfh_secret');
    expect(host.textContent).toContain('You won’t be able to see it again.');
    expect(host.querySelector('input')!.value).toBe('');
    await act(async () => button('Done').click());
    expect(host.textContent).not.toContain('bfh_secret');
  });

  it('keeps the typed name and shows the stop toast when saving fails', async () => {
    m.create.mockRejectedValue(new Error('network'));
    await render([]);
    await type('Rob’s PC');
    await submit();
    expect(host.querySelector('input')!.value).toBe('Rob’s PC');
    expect(m.toast).toHaveBeenCalledWith({ tone: 'stop', title: 'Nothing was saved.', detail: 'Try again.' });
  });

  it('asks before revoking, then revokes that key', async () => {
    m.revoke.mockResolvedValue({ ok: true });
    await render([key('1', 'Rob’s PC')]);
    await act(async () => button('Revoke').click());
    expect(host.textContent).toContain('Revoke Rob’s PC? The helper on that computer stops working until you give it a new key.');
    expect(m.revoke).not.toHaveBeenCalled();
    await act(async () => button('Revoke key').click());
    expect(m.revoke).toHaveBeenCalledWith('1');
    expect(m.toast).not.toHaveBeenCalled();
  });

  it('tells the officer when a revoke is refused', async () => {
    m.revoke.mockResolvedValue({ ok: false, error: 'That key wasn’t found. It may already be revoked.' });
    await render([key('1', 'Rob’s PC')]);
    await act(async () => button('Revoke').click());
    await act(async () => button('Revoke key').click());
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'stop', title: 'That key wasn’t found. It may already be revoked.' }));
  });
});
