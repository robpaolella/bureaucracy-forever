import { buttonClassName, TextLink } from '@/components/ui';
import { HELPER_RELEASES_URL, type HelperReleaseFound } from '@/lib/addon-release';
import { GET_ADDON as ADDON_COPY, GET_HELPER as COPY } from './copy';
import { When } from './HelperKeys';

/** "Get the helper": the desktop helper's latest release, with the same failure states as the add-on card (design #272, version A). */
export function GetHelper({ found }: { found: HelperReleaseFound }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="get-helper">
      <h2 id="get-helper" className="font-display text-2xl font-medium">
        {COPY.heading}
      </h2>
      <div className="flex flex-col gap-3 rounded-card border border-line bg-ink-900 p-4 md:p-5">
        <p className="text-sm text-fg-2">{COPY.lede}</p>
        {found.status === 'none' && <p className="text-sm text-fg-2">{ADDON_COPY.none}</p>}
        {found.status === 'unreachable' && (
          <>
            <p className="text-sm text-fg-2">{ADDON_COPY.unreachable}</p>
            <TextLink href={HELPER_RELEASES_URL} className="self-start">
              {ADDON_COPY.allReleases}
            </TextLink>
          </>
        )}
        {found.status === 'release' && (
          <>
            <p className="text-sm text-fg-2">
              <span className="font-semibold text-fg">
                {ADDON_COPY.version} {found.release.version}
              </span>{' '}
              <span className="text-fg-3">
                · {ADDON_COPY.released} <When at={found.release.publishedAt} />
              </span>
            </p>
            {found.stale && <p className="text-xs text-fg-3">{ADDON_COPY.stale}</p>}
            <div className="flex flex-wrap gap-2.5">
              <a href={found.release.macUrl} className={buttonClassName({ variant: 'secondary' })}>
                {COPY.mac}
              </a>
              <a href={found.release.windowsUrl} className={buttonClassName({ variant: 'secondary' })}>
                {COPY.windows}
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
