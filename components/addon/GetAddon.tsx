import { buttonClassName, TextLink } from '@/components/ui';
import { ADDON_GUIDE_URL, ADDON_RELEASES_URL, type AddonRelease } from '@/lib/addon-release';
import { GET_ADDON as COPY } from './copy';
import { When } from './HelperKeys';

/** "Get the add-on": the latest release, or why there isn't one to show (design #272, version A). */
export function GetAddon({ found }: { found: AddonRelease }) {
  const guide = (
    <TextLink href={ADDON_GUIDE_URL} className="self-start">
      {COPY.guide}
    </TextLink>
  );
  return (
    <section className="flex flex-col gap-3" aria-labelledby="get-addon">
      <h2 id="get-addon" className="font-display text-2xl font-medium">
        {COPY.heading}
      </h2>
      <div className="flex flex-col gap-3 rounded-card border border-line bg-ink-900 p-4 md:p-5">
        {found.status === 'none' && <p className="text-sm text-fg-2">{COPY.none}</p>}
        {found.status === 'unreachable' && (
          <>
            <p className="text-sm text-fg-2">{COPY.unreachable}</p>
            <TextLink href={ADDON_RELEASES_URL} className="self-start">
              {COPY.allReleases}
            </TextLink>
          </>
        )}
        {found.status === 'release' && (
          <>
            <p className="text-sm text-fg-2">
              <span className="font-semibold text-fg">
                {COPY.version} {found.release.version}
              </span>{' '}
              <span className="text-fg-3">
                · {COPY.released} <When at={found.release.publishedAt} />
              </span>
            </p>
            {found.stale && <p className="text-xs text-fg-3">{COPY.stale}</p>}
            <div className="flex flex-wrap gap-2.5">
              <a href={found.release.downloadUrl} className={buttonClassName({ variant: 'primary' })}>
                {COPY.download}
              </a>
            </div>
          </>
        )}
        {guide}
      </div>
    </section>
  );
}
