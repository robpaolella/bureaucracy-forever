/**
 * The add-on's latest GitHub release (#280): shown on /officers/addon and carried in the reserve
 * snapshot. GitHub allows 60 unauthenticated requests an hour per address, shared on Vercel, so
 * the answer is cached for minutes. "Last version seen" lives in this server instance's memory
 * only: after a cold start with GitHub down, nothing has been seen.
 */
import 'server-only';

export const ADDON_REPO = 'robpaolella/bureaucracy-forever-addon';
export const ADDON_RELEASES_URL = `https://github.com/${ADDON_REPO}/releases`;
/** The install guide (addon#25) doesn't exist yet; swap this when it does. */
export const ADDON_GUIDE_URL = `https://github.com/${ADDON_REPO}`;

const LATEST_URL = `https://api.github.com/repos/${ADDON_REPO}/releases/latest`;
const FRESH_MS = 10 * 60_000;
/** A failed lookup is retried sooner than a good one, but not on every page view. */
const FAILED_MS = 60_000;
const TIMEOUT_MS = 5_000;

export type SeenRelease = {
  version: string;
  /** ISO instant. */
  publishedAt: string;
  /** The zip asset, or the release's page when it has none. */
  downloadUrl: string;
};

export type AddonRelease =
  | { status: 'release'; release: SeenRelease; /** GitHub couldn't be reached; this is the last version seen. */ stale: boolean }
  | { status: 'none' }
  | { status: 'unreachable' };

type Lookup = { kind: 'release'; release: SeenRelease } | { kind: 'none' } | { kind: 'failed' };

type GithubRelease = { tag_name?: unknown; html_url?: unknown; published_at?: unknown; assets?: unknown };

/** A GitHub release as the page needs it, or null when it isn't one. */
export function parseRelease(raw: unknown): SeenRelease | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as GithubRelease;
  if (typeof r.tag_name !== 'string' || typeof r.html_url !== 'string' || typeof r.published_at !== 'string') return null;
  const version = r.tag_name.replace(/^v/i, '');
  if (!version || Number.isNaN(Date.parse(r.published_at))) return null;
  const assets = Array.isArray(r.assets) ? r.assets : [];
  const zip = assets.find(
    (a): a is { name: string; browser_download_url: string } =>
      typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.zip') && typeof a?.browser_download_url === 'string',
  );
  return { version, publishedAt: new Date(r.published_at).toISOString(), downloadUrl: zip?.browser_download_url ?? r.html_url };
}

async function fetchLatest(): Promise<Lookup> {
  try {
    const res = await fetch(LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'bureaucracy-guild-site' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // "Latest" skips drafts and pre-releases; with none, GitHub answers not found.
    if (res.status === 404) return { kind: 'none' };
    if (!res.ok) return { kind: 'failed' };
    const release = parseRelease(await res.json());
    return release ? { kind: 'release', release } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

let lastSeen: SeenRelease | null = null;
let cached: { at: number; ttl: number; value: Promise<AddonRelease> } | null = null;

async function lookup(): Promise<AddonRelease> {
  const found = await fetchLatest();
  if (found.kind === 'release') {
    lastSeen = found.release;
    return { status: 'release', release: found.release, stale: false };
  }
  if (found.kind === 'none') {
    lastSeen = null;
    return { status: 'none' };
  }
  return lastSeen ? { status: 'release', release: lastSeen, stale: true } : { status: 'unreachable' };
}

/** The latest release, from the cache when it is under ten minutes old (a failure is kept for one). */
export function getAddonRelease(now: number = Date.now()): Promise<AddonRelease> {
  if (cached && now - cached.at < cached.ttl) return cached.value;
  // The in-flight promise is cached, so simultaneous page views share one request.
  const entry = { at: now, ttl: FRESH_MS, value: lookup() };
  entry.value.then((v) => {
    if (v.status === 'unreachable' || (v.status === 'release' && v.stale)) entry.ttl = FAILED_MS;
  });
  cached = entry;
  return entry.value;
}

/** The snapshot's `addon` field: the version and where to get it, or the placeholder. */
export function addonForSnapshot(found: AddonRelease): { version: string; url: string } {
  return found.status === 'release'
    ? { version: found.release.version, url: found.release.downloadUrl }
    : { version: '', url: `${ADDON_RELEASES_URL}/latest` };
}

/** Test hook: forget the cache and the last version seen. */
export function resetAddonReleaseForTests() {
  cached = null;
  lastSeen = null;
}
