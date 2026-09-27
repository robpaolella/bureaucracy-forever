import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RaidPlanner, type SeriesRow, type TemplateRow } from '@/components/planner/RaidPlanner';
import { db } from '@/lib/db';
import { parseRequirements } from '@/lib/raids';
import { getSession } from '@/lib/session';
import { PLANNER_HEAD } from '@/content/planner';

export const metadata: Metadata = { title: 'Raids and series', robots: { index: false, follow: false } };

/** /officers/raids (SYNC-SPEC §9.3): templates and the weekly series that make the calendar. */
export default async function RaidsPlannerPage() {
  const session = await getSession();
  if (!session || session.role !== 'officer') notFound();
  const [templates, series] = await Promise.all([
    db.raidTemplate.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    db.raidSeries.findMany({ include: { template: { select: { name: true } }, _count: { select: { raids: { where: { status: 'SCHEDULED' } } } } }, orderBy: [{ active: 'desc' }, { weekday: 'asc' }, { startTime: 'asc' }] }),
  ]);
  const templateRows: TemplateRow[] = templates.map((t) => ({ id: t.id, name: t.name, short: t.short, size: t.size, durationMin: t.durationMin, requirements: parseRequirements(t.requirements), active: t.active }));
  const seriesRows: SeriesRow[] = series.map((s) => ({ id: s.id, templateId: s.templateId, templateName: s.template.name, weekday: s.weekday, startTime: s.startTime, durationMin: s.durationMin, notes: s.notes ?? '', postAheadDays: s.postAheadDays, lockMinutesBefore: s.lockMinutesBefore, horizonWeeks: s.horizonWeeks, active: s.active, raids: s._count.raids }));
  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{PLANNER_HEAD.eyebrow}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{PLANNER_HEAD.title}</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{PLANNER_HEAD.lede}</p>
      </section>
      <RaidPlanner templates={templateRows} series={seriesRows} />
    </div>
  );
}
