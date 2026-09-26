import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { ApplicationView } from '@/components/applications/ApplicationView';
import { Inbox } from '@/components/applications/Inbox';
import { loadApplication, loadInbox, markRead } from '@/lib/applications-data';
import { selectApplication } from '@/lib/applications-inbox';
import { getSession } from '@/lib/session';
import { INBOX, INBOX_HEAD } from '@/content/applications';

export const metadata: Metadata = {
  title: 'Applications — Bureaucracy',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * The inbox (docs/04 § Applications inbox): list left, the open application right. `?id=`
 * picks one; otherwise the first pending. Opening one clears its unread dot after the
 * response goes out.
 */
export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session || session.role !== 'officer') notFound();
  const items = await loadInbox();
  const requested = one((await searchParams).id);
  const selectedId = selectApplication(items, requested);
  const app = selectedId ? await loadApplication(selectedId) : null;
  if (app?.unread) after(() => markRead(app.id));
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{INBOX_HEAD.eyebrow}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{INBOX_HEAD.title}</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{INBOX_HEAD.lede}</p>
      </section>
      <Inbox items={items} selectedId={app?.id ?? null} now={now}>
        {app ? <ApplicationView app={app} now={now} /> : <p className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-sm text-fg-2">{INBOX.pickOne}</p>}
      </Inbox>
    </div>
  );
}
