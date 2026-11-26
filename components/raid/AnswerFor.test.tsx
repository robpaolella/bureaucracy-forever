// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/ui';
import { AnswerFor } from './AnswerFor';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

let root: Root, host: HTMLDivElement;
const fetcher = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fetcher.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

// An officer answering for someone is never asked about the member's character level (#567).
it('writes an officer’s answer for a member straight away, with no question', async () => {
  await act(async () => root.render(<ToastHost><AnswerFor raidId="r" userId="u1" name="Grimbo" current={null} /></ToastHost>));
  const select = host.querySelector('select')!;
  await act(async () => { select.value = 'accept'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.querySelector('dialog')).toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ response: 'accept', forUserId: 'u1' });
});
