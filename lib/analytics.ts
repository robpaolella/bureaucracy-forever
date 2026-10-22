/**
 * Keeps only the path of an analytics event's address. Some pages carry personal values in
 * the query string (an applicant's character, an application id), so no query or fragment
 * ever leaves the browser. Shared by Vercel Analytics and Speed Insights.
 */
export function stripQuery<T extends { url: string }>(event: T): T {
  try {
    const parsed = new URL(event.url);
    return { ...event, url: `${parsed.origin}${parsed.pathname}` };
  } catch {
    // Not an absolute address: cut at the first `?` or `#`.
    return { ...event, url: event.url.split(/[?#]/)[0] };
  }
}
