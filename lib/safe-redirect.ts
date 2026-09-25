/**
 * Only same-origin, path-absolute redirect targets. Rejects `//host`, `http://…`,
 * and backslash tricks. Shared by the login route and the dev session switcher.
 */
export function safeRedirect(raw: string | null | undefined, requestUrl: string, fallback = '/'): URL {
  const fallbackUrl = new URL(fallback, requestUrl);
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallbackUrl;
  let target: URL;
  try {
    target = new URL(raw, requestUrl);
  } catch {
    return fallbackUrl;
  }
  return target.origin === fallbackUrl.origin ? target : fallbackUrl;
}
