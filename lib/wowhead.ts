/**
 * Item details from Wowhead's tooltip endpoint. Wowhead blocks heavy scraping, so this is
 * called only by the loot import script and the officer refresh action — never while
 * rendering a page — and always one request at a time, about a second apart.
 */
import type { ItemSource } from '@/lib/loot-rules';

export type WowheadItem = { id: number; name: string; quality: number; icon: string; tooltip: string };
export type FetchResult = { ok: true; item: WowheadItem } | { ok: false; id: number; error: string };

/** Pause between requests; a little over a second. */
export const WOWHEAD_GAP_MS = 1100;
const TIMEOUT_MS = 5000;

const DATABASE: Record<ItemSource, string> = { CLASSIC: 'classic', FOREVER: 'forever' };

export function tooltipUrl(id: number, source: ItemSource): string {
  return `https://nether.wowhead.com/${DATABASE[source]}/tooltip/item/${id}`;
}

export function iconUrl(icon: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  return `https://wow.zamimg.com/images/wow/icons/${size}/${encodeURIComponent(icon.toLowerCase())}.jpg`;
}

/** Reads Wowhead's JSON; `{"error":"Entity not found"}` and anything malformed are errors. */
export function parseTooltipJson(id: number, body: unknown): FetchResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (typeof b.error === 'string') return { ok: false, id, error: b.error };
  const { name, quality, icon, tooltip } = b;
  if (typeof name !== 'string' || !name || !Number.isInteger(quality) || typeof icon !== 'string' || typeof tooltip !== 'string') {
    return { ok: false, id, error: 'Unexpected response from Wowhead.' };
  }
  // The icon name ends up in an image URL; keep it to Wowhead's own shape.
  if (!/^[a-z0-9_-]+$/i.test(icon)) return { ok: false, id, error: 'Unexpected icon name from Wowhead.' };
  return { ok: true, item: { id, name, quality: quality as number, icon: icon.toLowerCase(), tooltip } };
}

export async function fetchItem(id: number, source: ItemSource, fetcher: typeof fetch = fetch): Promise<FetchResult> {
  try {
    const res = await fetcher(tooltipUrl(id, source), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok && res.status !== 404) return { ok: false, id, error: `Wowhead answered ${res.status}.` };
    const body: unknown = await res.json().catch(() => null);
    return parseTooltipJson(id, body);
  } catch (e) {
    return { ok: false, id, error: e instanceof Error && e.name === 'TimeoutError' ? 'Wowhead did not answer in time.' : 'Could not reach Wowhead.' };
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn` over `ids` one at a time with `gapMs` between calls. `fn` returning `'skip'`
 * made no request, so no gap follows it.
 */
export async function throttled<T>(ids: readonly number[], fn: (id: number) => Promise<T | 'skip'>, gapMs = WOWHEAD_GAP_MS): Promise<T[]> {
  const out: T[] = [];
  let requested = false;
  for (const id of ids) {
    if (requested) await wait(gapMs);
    const r = await fn(id);
    requested = r !== 'skip';
    if (r !== 'skip') out.push(r);
  }
  return out;
}
