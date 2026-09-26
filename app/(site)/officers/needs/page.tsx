import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NeedsEditor } from '@/components/needs/NeedsEditor';
import { getAllNeedRows } from '@/lib/class-needs-data';
import { getSession } from '@/lib/session';
import { NEEDS_EDITOR_HEAD } from '@/content/needs-editor';

export const metadata: Metadata = {
  title: 'Edit class needs — Bureaucracy',
  robots: { index: false, follow: false },
};

/** The class-needs editor (docs/02: "Edit class needs" in the Officers menu). */
export default async function NeedsEditorPage() {
  const session = await getSession();
  if (!session || session.role !== 'officer') notFound();
  const rows = await getAllNeedRows();

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{NEEDS_EDITOR_HEAD.eyebrow}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{NEEDS_EDITOR_HEAD.title}</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{NEEDS_EDITOR_HEAD.lede}</p>
      </section>
      <NeedsEditor rows={rows} />
    </div>
  );
}
