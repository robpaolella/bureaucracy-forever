/** Reads pages from foreverchanges.pro for the Load table. Only that host is ever contacted. */

export const FOREVERCHANGES_ORIGIN = 'https://foreverchanges.pro';
export const FOREVERCHANGES_TIMEOUT_MS = 15_000;
export const FOREVERCHANGES_MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;

export type PageResult = { ok: true; html: string } | { ok: false; reason: 'unreachable' | 'too-large' };

/** A dungeon slug as foreverchanges.pro writes it; anything else is never put in a URL. */
export const isForeverSlug = (slug: unknown): slug is string => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;

/** Reads a body up to the size limit; null when it is bigger. */
async function boundedText(res: Response): Promise<string | null> {
  const length = Number(res.headers.get('content-length'));
  if (Number.isFinite(length) && length > FOREVERCHANGES_MAX_BYTES) return null;
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > FOREVERCHANGES_MAX_BYTES) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

/**
 * GETs `path` ("/dungeons" or "/dungeons/<slug>") on foreverchanges.pro. Redirects are followed by
 * hand and only while they stay on that host over https; any other redirect counts as unreachable.
 */
export async function fetchForeverPage(path: string): Promise<PageResult> {
  const signal = AbortSignal.timeout(FOREVERCHANGES_TIMEOUT_MS);
  try {
    let url = new URL(path, FOREVERCHANGES_ORIGIN);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (url.origin !== FOREVERCHANGES_ORIGIN) return { ok: false, reason: 'unreachable' };
      const res = await fetch(url, { redirect: 'manual', signal, headers: { Accept: 'text/html' } });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return { ok: false, reason: 'unreachable' };
        url = new URL(location, url);
        continue;
      }
      if (!res.ok) return { ok: false, reason: 'unreachable' };
      const html = await boundedText(res);
      return html === null ? { ok: false, reason: 'too-large' } : { ok: true, html };
    }
    return { ok: false, reason: 'unreachable' };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}
