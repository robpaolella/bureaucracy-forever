import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { ApplicationView } from '@/components/applications/ApplicationView';
import { loadApplication, markRead } from '@/lib/applications-data';
import { discordThreadUrl } from '@/lib/discord-links';
import { getSession } from '@/lib/session';
import { DETAIL } from '@/content/applications';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const session = await getSession();
  const { id } = await params;
  // Same guard as the page: an applicant's name never leaks into a title for non-officers.
  const app = session?.role === 'officer' ? await loadApplication(id) : null;
  return { title: app?.character ?? 'Application', robots: { index: false, follow: false } };
}

/** docs/04 § Application detail: the right pane of the inbox as its own page, where phones land. */
export default async function ApplicationPage({ params }: Params) {
  const session = await getSession();
  if (!session || session.role !== 'officer') notFound();
  const { id } = await params;
  const app = await loadApplication(id);
  if (!app) notFound();
  if (app.unread) after(() => markRead(app.id));

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <Link href={`/officers/applications?id=${app.id}`} className="inline-flex min-h-11 items-center self-start text-small text-fg-3 underline-offset-4 hover:underline">
        ← {DETAIL.back}
      </Link>
      <ApplicationView app={app} now={new Date().toISOString()} threadUrl={discordThreadUrl(app.discordThreadId)} />
    </div>
  );
}
