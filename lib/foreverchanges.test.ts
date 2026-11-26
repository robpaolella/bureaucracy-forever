import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOREVERCHANGES_MAX_BYTES, FOREVERCHANGES_TIMEOUT_MS, fetchForeverPage, isForeverSlug } from './foreverchanges';

const fetcher = vi.fn();
afterEach(() => { fetcher.mockReset(); vi.unstubAllGlobals(); });
const stub = () => vi.stubGlobal('fetch', fetcher);
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

describe('fetchForeverPage', () => {
  it('reads a page from foreverchanges.pro only', async () => {
    stub();
    fetcher.mockResolvedValue(new Response('<p>hi</p>'));
    expect(await fetchForeverPage('/dungeons/the-deadmines')).toEqual({ ok: true, html: '<p>hi</p>' });
    expect(String(fetcher.mock.calls[0][0])).toBe('https://foreverchanges.pro/dungeons/the-deadmines');
  });

  it('follows a redirect that stays on the host', async () => {
    stub();
    fetcher.mockResolvedValueOnce(redirect('/dungeons/')).mockResolvedValueOnce(new Response('ok'));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: true, html: 'ok' });
    expect(String(fetcher.mock.calls[1][0])).toBe('https://foreverchanges.pro/dungeons/');
  });

  it.each(['https://evil.test/x', 'http://foreverchanges.pro/x', 'https://foreverchanges.pro.evil.test/x', '//evil.test/x'])('refuses a redirect to %s', async (to) => {
    stub();
    fetcher.mockResolvedValueOnce(redirect(to));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: false, reason: 'unreachable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('gives up on a redirect loop and on a redirect with no address', async () => {
    stub();
    fetcher.mockImplementation(async () => redirect('/dungeons'));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: false, reason: 'unreachable' });
    fetcher.mockReset().mockResolvedValue(new Response(null, { status: 301 }));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('treats an error status or a network failure as unreachable', async () => {
    stub();
    fetcher.mockResolvedValueOnce(new Response('no', { status: 500 }));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: false, reason: 'unreachable' });
    fetcher.mockRejectedValueOnce(new Error('ENOTFOUND'));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('stops a request that outlasts the time limit and calls it unreachable', async () => {
    stub();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));
    fetcher.mockImplementation((_url: unknown, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      if (init.signal?.aborted) reject(init.signal.reason);
    }));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: false, reason: 'unreachable' });
    expect(timeout).toHaveBeenCalledWith(FOREVERCHANGES_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it('refuses a page larger than the limit, declared or streamed', async () => {
    stub();
    fetcher.mockResolvedValueOnce(new Response('x', { headers: { 'content-length': String(FOREVERCHANGES_MAX_BYTES + 1) } }));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: false, reason: 'too-large' });
    fetcher.mockResolvedValueOnce(new Response('x'.repeat(FOREVERCHANGES_MAX_BYTES + 1)));
    expect(await fetchForeverPage('/dungeons')).toEqual({ ok: false, reason: 'too-large' });
  });
});

describe('isForeverSlug', () => {
  it('accepts index slugs and nothing that could change the address', () => {
    expect(isForeverSlug('the-deadmines')).toBe(true);
    for (const bad of ['', 'a/b', '../x', 'a#quests', 'a?b', 'A', 'a b', '-a', 42, null, 'a'.repeat(81)]) expect(isForeverSlug(bad)).toBe(false);
  });
});
