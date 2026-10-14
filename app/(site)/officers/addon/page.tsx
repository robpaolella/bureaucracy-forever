import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GetAddon } from '@/components/addon/GetAddon';
import { HelperKeys } from '@/components/addon/HelperKeys';
import { ADDON_HEAD } from '@/components/addon/copy';
import { ToastHost } from '@/components/ui';
import { getAddonRelease } from '@/lib/addon-release';
import { lootEnabled } from '@/lib/flags';
import { HELPER_KEY_NAME_MAX, listHelperKeys } from '@/lib/helper-keys';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: ADDON_HEAD.title, robots: { index: false, follow: false } };

/** /officers/addon: the officer's helper keys. Behind LOOT_ENABLED. */
export default async function AddonPage() {
  // Session first: it reads cookies, so the page renders per request and the flag is read at run time.
  const session = await getSession();
  if (!lootEnabled() || !session || session.role !== 'officer') notFound();
  const [listed, release] = await Promise.all([listHelperKeys(session), getAddonRelease()]);
  if (!listed.ok) notFound();
  const keys = listed.keys.map((key) => ({ id: key.id, name: key.name, createdAt: key.createdAt.toISOString(), lastUsedAt: key.lastUsedAt?.toISOString() ?? null }));

  return (
    <ToastHost>
      <div className="flex flex-col gap-8 px-4 pb-12 pt-8 md:px-12 md:pt-11">
        <section className="flex flex-col gap-3">
          <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{ADDON_HEAD.eyebrow}</span>
          <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{ADDON_HEAD.title}</h1>
          <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{ADDON_HEAD.lede}</p>
        </section>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <GetAddon found={release} />
        </div>
        <HelperKeys keys={keys} nameMax={HELPER_KEY_NAME_MAX} />
      </div>
    </ToastHost>
  );
}
