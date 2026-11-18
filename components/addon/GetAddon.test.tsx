// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/time/useViewerTimeZone', () => ({ useViewerTimeZone: () => null }));
vi.mock('@/app/actions/helper-keys', () => ({ createHelperKeyAction: vi.fn(), revokeHelperKeyAction: vi.fn() }));

import type { AddonRelease } from '@/lib/addon-release';
import { GetAddon } from './GetAddon';

const release: AddonRelease = { status: 'release', stale: false, release: { version: '1.2.0', publishedAt: '2026-11-03T18:00:00.000Z', downloadUrl: 'https://example.test/a.zip' } };

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function show(found: AddonRelease) {
  await act(async () => root.render(<GetAddon found={found} />));
  return host.textContent ?? '';
}
const guide = () => host.querySelector<HTMLAnchorElement>('a[href="https://github.com/robpaolella/bureaucracy-forever-addon"]');

describe('GetAddon', () => {
  it('shows the version, date, download and guide', async () => {
    const text = await show(release);
    expect(text).toContain('Version 1.2.0');
    expect(text).toContain('released Nov 3, 2026');
    expect(host.querySelector<HTMLAnchorElement>('a[href="https://example.test/a.zip"]')?.textContent).toBe('Download the add-on (zip)');
    expect(guide()).not.toBeNull();
    expect(text).not.toContain('Couldn’t check');
  });

  it('says it could not check for a newer version when showing the last one seen', async () => {
    expect(await show({ ...release, stale: true } as AddonRelease)).toContain('Couldn’t check for a newer version just now.');
  });

  it('says there is no release yet, keeping the guide', async () => {
    const text = await show({ status: 'none' });
    expect(text).toContain('No release yet. It will appear here once the first version is published.');
    expect(host.querySelector('a[href$=".zip"]')).toBeNull();
    expect(guide()).not.toBeNull();
  });

  it('with nothing ever seen, says so and links all releases', async () => {
    const text = await show({ status: 'unreachable' });
    expect(text).toContain('Couldn’t check for the latest version just now.');
    expect(host.querySelector('a[href="https://github.com/robpaolella/bureaucracy-forever-addon/releases"]')?.textContent).toBe('See all releases on GitHub');
  });
});
