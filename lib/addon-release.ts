/**
 * The add-on's latest GitHub release (#280): shown on /officers/addon and carried in the reserve
 * snapshot. GitHub allows 60 unauthenticated requests an hour per address, shared on Vercel, so
 * the answer is cached for minutes. "Last version seen" lives in this server instance's memory
 * only: after a cold start with GitHub down, nothing has been seen.
 */
import 'server-only';

export const ADDON_REPO = 'robpaolella/bureaucracy-forever-addon';
export const ADDON_RELEASES_URL = `https://github.com/${ADDON_REPO}/releases`;
export const HELPER_REPO = 'robpaolella/bureaucracy-forever-helper';
export const HELPER_RELEASES_URL = `https://github.com/${HELPER_REPO}/releases`;
/** The install guide (addon#25) doesn't exist yet; swap this when it does. */
export const ADDON_GUIDE_URL = `https://github.com/${ADDON_REPO}`;

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

type Lookup<T> = { kind: 'release'; release: T } | { kind: 'none' } | { kind: 'failed' };
export type Found<T> =
  | { status: 'release'; release: T; /** GitHub couldn't be reached; this is the last version seen. */ stale: boolean }
  | { status: 'none' }
  | { status: 'unreachable' };

type GithubRelease = { tag_name?: unknown; html_url?: unknown; published_at?: unknown; assets?: unknown };
type Asset = { name: string; browser_download_url: string };

function assetsOf(r: GithubRelease): Asset[] {
  const assets = Array.isArray(r.assets) ? r.assets : [];
  return assets.filter((a): a is Asset => typeof a?.name === 'string' && typeof a?.browser_download_url === 'string');
}

/** The parts of a GitHub release every card shows, or null when it isn't one. */
function parseCommon(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as GithubRelease;
  if (typeof r.tag_name !== 'string' || typeof r.html_url !== 'string' || typeof r.published_at !== 'string') return null;
  const version = r.tag_name.replace(/^v/i, '');
  if (!version || Number.isNaN(Date.parse(r.published_at))) return null;
  return { version, publishedAt: new Date(r.published_at).toISOString(), pageUrl: r.html_url, assets: assetsOf(r) };
}

/** A GitHub release as the add-on page needs it, or null when it isn't one. */
export function parseRelease(raw: unknown): SeenRelease | null {
  const c = parseCommon(raw);
  if (!c) return null;
  const zip = c.assets.find((a) => a.name.toLowerCase().endsWith('.zip'));
  return { version: c.version, publishedAt: c.publishedAt, downloadUrl: zip?.browser_download_url ?? c.pageUrl };
}

/** The desktop helper's release (#313): the two installers officers are offered. */
export type HelperRelease = {
  version: string;
  publishedAt: string;
  /** The Apple silicon .dmg, or the release's page when it has none. */
  macUrl: string;
  /** The NSIS setup .exe (not the .msi), or the release's page when it has none. */
  windowsUrl: string;
};

/** Files are named `bureaucracy-forever-helper_<version>_<platform>.<ext>` by the helper's release workflow. */
export function parseHelperRelease(raw: unknown): HelperRelease | null {
  const c = parseCommon(raw);
  if (!c) return null;
  const pick = (suffix: string) => c.assets.find((a) => a.name.toLowerCase().endsWith(suffix))?.browser_download_url ?? c.pageUrl;
  return { version: c.version, publishedAt: c.publishedAt, macUrl: pick('_macos-apple-silicon.dmg'), windowsUrl: pick('_windows-x64-setup.exe') };
}

/** One repo's cached "latest release" lookup. Each repo has its own, so caches never mix. */
function createLookup<T>(repo: string, parse: (raw: unknown) => T | null) {
  let lastSeen: T | null = null;
  let cached: { at: number; ttl: number; value: Promise<Found<T>> } | null = null;

  async function fetchLatest(): Promise<Lookup<T>> {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'bureaucracy-guild-site' },
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // "Latest" skips drafts and pre-releases; with none, GitHub answers not found.
      if (res.status === 404) return { kind: 'none' };
      if (!res.ok) return { kind: 'failed' };
      const release = parse(await res.json());
      return release ? { kind: 'release', release } : { kind: 'failed' };
    } catch {
      return { kind: 'failed' };
    }
  }

  async function lookup(): Promise<Found<T>> {
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

  return {
    /** The latest release, from the cache when it is under ten minutes old (a failure is kept for one). */
    get(now: number): Promise<Found<T>> {
      if (cached && now - cached.at < cached.ttl) return cached.value;
      // The in-flight promise is cached, so simultaneous page views share one request.
      const entry = { at: now, ttl: FRESH_MS, value: lookup() };
      entry.value.then((v) => {
        if (v.status === 'unreachable' || (v.status === 'release' && v.stale)) entry.ttl = FAILED_MS;
      });
      cached = entry;
      return entry.value;
    },
    reset() {
      cached = null;
      lastSeen = null;
    },
  };
}

const addonLookup = createLookup(ADDON_REPO, parseRelease);
const helperLookup = createLookup(HELPER_REPO, parseHelperRelease);

export type AddonRelease = Found<SeenRelease>;
export type HelperReleaseFound = Found<HelperRelease>;

export const getAddonRelease = (now: number = Date.now()): Promise<AddonRelease> => addonLookup.get(now);
export const getHelperRelease = (now: number = Date.now()): Promise<HelperReleaseFound> => helperLookup.get(now);

/** The snapshot's `addon` field: the version and where to get it, or the placeholder. */
export function addonForSnapshot(found: AddonRelease): { version: string; url: string } {
  return found.status === 'release'
    ? { version: found.release.version, url: found.release.downloadUrl }
    : { version: '', url: `${ADDON_RELEASES_URL}/latest` };
}

/** Test hook: forget both caches and the last version seen. */
export function resetAddonReleaseForTests() {
  addonLookup.reset();
  helperLookup.reset();
}
