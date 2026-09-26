/**
 * A small fixed-window limiter kept in process memory. Best effort: each server instance
 * counts on its own and a restart forgets, which is fine for slowing a form down. The
 * honeypot and the duplicate check carry the rest (docs/06 § API routes: "rate-limit it").
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}
