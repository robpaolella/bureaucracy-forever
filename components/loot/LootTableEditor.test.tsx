// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LootTableEditor, type EditorBoss } from './LootTableEditor';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const bosses: EditorBoss[] = [{
  id: 'b1', name: 'Lucifron', isTrash: false,
  items: [{ id: 7, name: 'Ashen Signet', quality: 4, icon: 'inv_ring', tooltipHtml: '' }],
}];

let root: Root, host: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(
    <LootTableEditor templateId="mc" templateName="Molten Core" bosses={bosses} defaultSource="FOREVER" blockedIds={[]} winLimits={{}} />,
  ));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === text)!;
const dialogs = () => [...host.querySelectorAll('dialog')].filter((d) => d.open);
const openRemove = async () => act(async () => {
  host.querySelector<HTMLButtonElement>('[aria-label="Remove Ashen Signet from Lucifron"]')!.click();
});

describe('removing an item', () => {
  it('asks first and sends nothing', async () => {
    await openRemove();
    const [dialog] = dialogs();
    expect(dialogs()).toHaveLength(1);
    expect(dialog.querySelector('h2')!.textContent).toBe('Remove Ashen Signet?');
    expect(dialog.textContent).toContain("Lucifron's list");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('puts Keep it first and Remove the item last', async () => {
    await openRemove();
    const labels = [...dialogs()[0].querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(['Keep it', 'Remove the item']);
  });

  it('closes on Keep it without a request', async () => {
    await openRemove();
    await act(async () => button('Keep it').click());
    expect(dialogs()).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('closes on Escape without a request', async () => {
    await openRemove();
    await act(async () => { dialogs()[0].dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })); });
    expect(dialogs()).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the DELETE, toasts and closes on Remove the item', async () => {
    await openRemove();
    await act(async () => button('Remove the item').click());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/loot/bosses/b1/items/7');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(dialogs()).toHaveLength(0);
    expect([...host.querySelectorAll('[role="status"]')].map((t) => t.textContent)).toContain('Removed Ashen Signet');
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the error when the remove fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Nope' }) });
    await openRemove();
    await act(async () => button('Remove the item').click());
    expect(dialogs()).toHaveLength(1);
    expect([...host.querySelectorAll('[role="status"],[role="alert"]')].map((t) => t.textContent).join()).toContain('Nope');
  });
});
