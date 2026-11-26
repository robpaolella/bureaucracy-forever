// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/ui';
import { LOOT_LOG } from '@/content/loot-log';
import { CopyReservesBar } from './CopyReservesBar';

const copy = LOOT_LOG.addon;
const fetcher = vi.fn();
const write = vi.fn();
let root: Root, host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks(); fetcher.mockReset(); write.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetcher);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const render = (reserves = 23, awards = 4) => act(async () => root.render(<ToastHost><CopyReservesBar raidId="raid" reserves={reserves} awards={awards} /></ToastHost>));
const parts = (...p: string[]) => fetcher.mockResolvedValue({ ok: true, json: async () => ({ parts: p }) });
const press = () => act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent === copy.copy)!.click(); });
const status = () => host.querySelector('[role="status"]')!.textContent;

describe('CopyReservesBar', () => {
  it('shows the counts it was given', async () => {
    await render(23, 4);
    expect(host.textContent).toContain('Includes 23 reserves and 4 awards so far.');
    expect(host.textContent).toContain(copy.heading);
  });

  it('says nobody has reserved, and still copies', async () => {
    parts('BFSNAP1:1/1:x');
    await render(0, 0);
    expect(host.textContent).toContain(copy.noReserves);
    expect(host.textContent).not.toContain('Includes');
    await press();
    expect(write).toHaveBeenCalledWith('BFSNAP1:1/1:x');
  });

  it('copies a single-part snapshot in one press and announces it', async () => {
    parts('BFSNAP1:1/1:x');
    await render();
    await press();
    expect(fetcher).toHaveBeenCalledWith('/api/raids/raid/snapshot', expect.anything());
    expect(write).toHaveBeenCalledWith('BFSNAP1:1/1:x');
    expect(status()).toBe(copy.copied);
  });

  it('copies one part per press from one fetch, then starts over with a fresh fetch', async () => {
    parts('BFSNAP1:1/2:a', 'BFSNAP1:2/2:b');
    await render();
    await press();
    expect(write).toHaveBeenLastCalledWith('BFSNAP1:1/2:a');
    expect(status()).toBe('Copied part 1 of 2. Paste it in game, then press Copy again for part 2.');
    await press();
    expect(write).toHaveBeenLastCalledWith('BFSNAP1:2/2:b');
    expect(status()).toBe('Copied part 2 of 2. Paste it in game.');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await press();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith('BFSNAP1:1/2:a');
  });

  it('shows the refused part selected in a box, and moves on to the next part', async () => {
    parts('BFSNAP1:1/2:a', 'BFSNAP1:2/2:b');
    write.mockRejectedValueOnce(new Error('denied'));
    await render();
    await press();
    const box = host.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(box.value).toBe('BFSNAP1:1/2:a');
    expect(host.querySelector('label')!.textContent).toBe(copy.blocked);
    expect(document.activeElement).toBe(box);
    await press();
    expect(write).toHaveBeenLastCalledWith('BFSNAP1:2/2:b');
    expect(host.querySelector('textarea')).toBeNull();
  });

  it('treats a missing clipboard as blocked', async () => {
    parts('BFSNAP1:1/1:x');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await render();
    await press();
    expect(host.querySelector('textarea')!.value).toBe('BFSNAP1:1/1:x');
  });

  it.each([
    ['a refused request', () => fetcher.mockResolvedValue({ ok: false, json: async () => ({ error: 'no' }) })],
    ['a network failure', () => fetcher.mockRejectedValue(new Error('offline'))],
    ['an unreadable answer', () => fetcher.mockResolvedValue({ ok: true, json: async () => ({ parts: [] }) })],
  ])('tells the officer when the fetch fails (%s) and copies nothing', async (_name, setup) => {
    setup();
    await render();
    await press();
    expect(write).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(copy.fetchFailed);
  });
});
