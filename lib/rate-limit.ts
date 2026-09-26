/**
 * A small fixed-window limiter kept in process memory. Best effort: each server instance
 * counts on its own and a restart forgets, which is fine for slowing a form down. The
 * honeypot and the duplicate check carry the rest (docs/06 § API routes: "rate-limit it").
 */
const hits = new Map<string, { count: number; resetAt: number }>();
const PRUNE_AT = 5000;
const HARD_CAP = 20000;

export function rateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    if (hits.size >= PRUNE_AT) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    // A flood of never-repeating keys cannot grow the map without bound.
    if (hits.size >= HARD_CAP) hits.clear();
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/**
 * The connecting address behind a proxy. Vercel sets x-real-ip; failing that the last
 * x-forwarded-for hop is the one the proxy appended, while the first is whatever the
 * client chose to send. Without either header every request shares one bucket, which
 * only matters off Vercel.
 */
export function clientAddress(headers: { get(name: string): string | null }): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const hops = headers.get('x-forwarded-for')?.split(',').map((h) => h.trim()).filter(Boolean) ?? [];
  return hops.length > 0 ? hops[hops.length - 1] : 'unknown';
}
