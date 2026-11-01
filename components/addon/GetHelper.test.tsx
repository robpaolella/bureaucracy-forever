// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/time/useViewerTimeZone', () => ({ useViewerTimeZone: () => null }));
vi.mock('@/app/actions/helper-keys', () => ({ createHelperKeyAction: vi.fn(), revokeHelperKeyAction: vi.fn() }));

import type { HelperReleaseFound } from '@/lib/addon-release';
import { GetHelper } from './GetHelper';

const release: HelperReleaseFound = { status: 'release', stale: false, release: { version: '0.3.0', publishedAt: '2026-11-08T12:00:00.000Z', macUrl: 'https://example.test/m.dmg', windowsUrl: 'https://example.test/w.exe' } };

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function show(found: HelperReleaseFound) {
  await act(async () => root.render(<GetHelper found={found} />));
  return host.textContent ?? '';
}
const links = () => [...host.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);

describe('GetHelper', () => {
  it('shows the sentence, version, date and the two downloads', async () => {
    const text = await show(release);
    expect(text).toContain('Get the helper');
    expect(text).toContain('The desktop helper delivers reserves and awards for you. Create a key for it below.');
    expect(text).toContain('Version 0.3.0');
    expect(text).toContain('released Nov 8, 2026');
    expect(links()).toEqual([['Download for Mac', 'https://example.test/m.dmg'], ['Download for Windows', 'https://example.test/w.exe']]);
    expect(text).not.toContain('Couldn’t check');
  });

  it('says it could not check for a newer version when showing the last one seen', async () => {
    expect(await show({ ...release, stale: true } as HelperReleaseFound)).toContain('Couldn’t check for a newer version just now.');
  });

  it('says there is no release yet, with no downloads', async () => {
    expect(await show({ status: 'none' })).toContain('No release yet. It will appear here once the first version is published.');
    expect(links()).toEqual([]);
  });

  it('links the helper releases page when GitHub is unreachable', async () => {
    expect(await show({ status: 'unreachable' })).toContain('Couldn’t check for the latest version just now.');
    expect(links()).toEqual([['See all releases on GitHub', 'https://github.com/robpaolella/bureaucracy-forever-helper/releases']]);
  });
});
