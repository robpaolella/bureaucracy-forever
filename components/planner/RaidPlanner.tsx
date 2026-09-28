'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Modal, StatusPill, ToastHost, useToast } from '@/components/ui';
import { ROLES } from '@/lib/design/class-colors';
import { WEEKDAY_LABELS, type SeriesInput, type TemplateInput } from '@/lib/raid-series-rules';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { GUILD_TIMEZONE } from '@/lib/config';
import { formatClock, formatGuildClock, nextOccurrence, type Weekday } from '@/lib/time';
import { SAVE_FAILED } from '@/content/calendar';
import { SERIES, TEMPLATES } from '@/content/planner';
import { SeriesForm } from './SeriesForm';
import { TemplateForm } from './TemplateForm';

export type TemplateRow = TemplateInput & { id: string };
export type SeriesRow = SeriesInput & { id: string; templateName: string; raids: number };

type Props = {
  templates: TemplateRow[];
  series: SeriesRow[];
  /** Guild Master or Administrator: shows Delete on templates (lib/auth/roles.ts). */
  canDeleteTemplates: boolean;
};

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

const failure = (r: { status: number; json: Record<string, unknown> }) => (r.status === 400 || r.status === 409 ? String(r.json.error ?? SAVE_FAILED) : SAVE_FAILED);

/** /officers/raids (SYNC-SPEC §9.3): the template table, the series list and the new-series form. */
export function RaidPlanner(props: Props) {
  return (
    <ToastHost>
      <Planner {...props} />
    </ToastHost>
  );
}

function Planner({ templates, series, canDeleteTemplates }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [editingSeries, setEditingSeries] = useState<SeriesRow | null>(null);
  const [deactivating, setDeactivating] = useState<SeriesRow | null>(null);
  const [deletingSeries, setDeletingSeries] = useState<SeriesRow | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TemplateRow | null>(null);
  const [busy, setBusy] = useState(false);
  const activeTemplates = templates.filter((t) => t.active);
  // Series still on the template being deleted: the route refuses those, so the modal says so up front.
  const templatesInUse = deletingTemplate ? series.filter((s) => s.templateId === deletingTemplate.id).length : 0;
  const blank: SeriesInput = { templateId: activeTemplates[0]?.id ?? '', weekday: 4, startTime: '20:00', durationMin: activeTemplates[0]?.durationMin ?? 180, notes: '', postAheadDays: 14, lockMinutesBefore: 120, horizonWeeks: 4, active: true };

  async function saveTemplate(input: TemplateInput): Promise<string | null> {
    if (!editingTemplate) return null;
    const r = await send(`/api/raid-templates/${editingTemplate.id}`, 'PATCH', input);
    if (!r.ok) return failure(r);
    toast({ tone: 'ok', title: TEMPLATES.saved(input.name) });
    setEditingTemplate(null);
    router.refresh();
    return null;
  }
  async function createSeries(input: SeriesInput): Promise<string | null> {
    const r = await send('/api/raid-series', 'POST', input);
    if (!r.ok) return failure(r);
    toast({ tone: 'ok', title: SERIES.created(Number(r.json.generated ?? 0)) });
    router.refresh();
    return null;
  }
  async function saveSeries(input: SeriesInput): Promise<string | null> {
    if (!editingSeries) return null;
    const r = await send(`/api/raid-series/${editingSeries.id}`, 'PATCH', input);
    if (!r.ok) return failure(r);
    toast({ tone: 'ok', title: SERIES.saved(Number(r.json.moved ?? 0), Number(r.json.generated ?? 0)) });
    setEditingSeries(null);
    router.refresh();
    return null;
  }
  async function setActive(row: SeriesRow, active: boolean) {
    if (busy) return;
    setBusy(true);
    const r = await send(`/api/raid-series/${row.id}`, 'PATCH', { active });
    setBusy(false);
    setDeactivating(null);
    toast(r.ok ? { tone: 'ok', title: active ? SERIES.reactivated : SERIES.deactivated } : { tone: 'stop', title: failure(r) });
    router.refresh();
  }
  async function deleteTemplate(row: TemplateRow) {
    if (busy) return;
    setBusy(true);
    const r = await send(`/api/raid-templates/${row.id}`, 'DELETE', {});
    setBusy(false);
    setDeletingTemplate(null);
    toast(r.ok || r.status === 404 ? { tone: 'ok', title: TEMPLATES.deleted(row.name) } : { tone: 'stop', title: failure(r) });
    router.refresh();
  }
  async function deleteSeries(row: SeriesRow) {
    if (busy) return;
    setBusy(true);
    const r = await send(`/api/raid-series/${row.id}`, 'DELETE', {});
    setBusy(false);
    setDeletingSeries(null);
    toast(r.ok || r.status === 404 ? { tone: 'ok', title: SERIES.deleted } : { tone: 'stop', title: failure(r) });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3" aria-labelledby="templates">
        <div className="flex flex-col gap-1">
          <h2 id="templates" className="font-display text-2xl font-medium">
            {TEMPLATES.heading}
          </h2>
          <p className="text-sm text-fg-2">{TEMPLATES.lede}</p>
        </div>
        <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-900">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">
                  {t.name} <span className="text-fg-3">· {t.short}</span>
                </span>
                <span className="tabular text-[13px] text-fg-3">
                  {t.size}-player · {t.durationMin} min · {ROLES.map((r) => t.requirements[r]).join(' / ')}
                </span>
              </div>
              <StatusPill tone={t.active ? 'ok' : 'closed'}>{t.active ? TEMPLATES.active : TEMPLATES.inactive}</StatusPill>
              <Button variant="secondary" size="sm" onClick={() => setEditingTemplate(t)} aria-label={`${TEMPLATES.edit} ${t.name}`}>
                {TEMPLATES.edit}
              </Button>
              {canDeleteTemplates && (
                <Button variant="ghost" size="sm" className="text-stop" onClick={() => setDeletingTemplate(t)} aria-label={`${TEMPLATES.delete} ${t.name}`}>
                  {TEMPLATES.delete}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="series">
        <div className="flex flex-col gap-1">
          <h2 id="series" className="font-display text-2xl font-medium">
            {SERIES.heading}
          </h2>
          <p className="text-sm text-fg-2">{SERIES.lede}</p>
        </div>
        {series.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-sm text-fg-2">{SERIES.empty}</p>
        ) : (
          <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-900">
            {series.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold">
                    {s.templateName} <span className="text-fg-3">· {WEEKDAY_LABELS[s.weekday]}s <SeriesTime weekday={s.weekday} startTime={s.startTime} /></span>
                  </span>
                  <span className="tabular text-[13px] text-fg-3">
                    {SERIES.summary(s)} · {SERIES.raids(s.raids)}
                    {s.notes && ` · ${s.notes}`}
                  </span>
                </div>
                <StatusPill tone={s.active ? 'ok' : 'closed'}>{s.active ? TEMPLATES.active : TEMPLATES.inactive}</StatusPill>
                <Button variant="secondary" size="sm" onClick={() => setEditingSeries(s)} aria-label={`${TEMPLATES.edit} ${s.templateName} ${WEEKDAY_LABELS[s.weekday]}`}>
                  {TEMPLATES.edit}
                </Button>
                {s.active ? (
                  <Button variant="ghost" size="sm" className="text-stop" onClick={() => setDeactivating(s)}>
                    {SERIES.deactivate}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" loading={busy} onClick={() => setActive(s, true)}>
                    {SERIES.reactivate}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-stop" onClick={() => setDeletingSeries(s)} aria-label={`${SERIES.delete} ${s.templateName} ${WEEKDAY_LABELS[s.weekday]}`}>
                  {SERIES.delete}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Card className="flex flex-col gap-4">
          <h3 className="text-[17px] font-semibold">{SERIES.newTitle}</h3>
          {activeTemplates.length === 0 ? <p className="text-sm text-fg-3">{SERIES.activateFirst}</p> : <SeriesForm key={series.length} templates={activeTemplates} initial={blank} submitLabel={SERIES.create} onSubmit={createSeries} />}
        </Card>
      </section>

      <Modal open={editingTemplate !== null} onClose={() => setEditingTemplate(null)} title={TEMPLATES.editTitle}>
        {editingTemplate && <TemplateForm initial={editingTemplate} onSubmit={saveTemplate} onCancel={() => setEditingTemplate(null)} />}
      </Modal>
      <Modal open={editingSeries !== null} onClose={() => setEditingSeries(null)} title={SERIES.editTitle}>
        {editingSeries && <SeriesForm templates={templates.filter((t) => t.active || t.id === editingSeries.templateId)} initial={editingSeries} submitLabel={SERIES.save} hint={SERIES.saveHint} onSubmit={saveSeries} onCancel={() => setEditingSeries(null)} />}
      </Modal>
      <Modal
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        title={SERIES.deactivateTitle}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeactivating(null)}>
              {SERIES.keep}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => deactivating && setActive(deactivating, false)}>
              {SERIES.deactivateConfirm}
            </Button>
          </>
        }
      >
        {SERIES.deactivateBody}
      </Modal>
      <Modal
        open={deletingTemplate !== null}
        onClose={() => setDeletingTemplate(null)}
        title={TEMPLATES.deleteTitle}
        actions={
          templatesInUse > 0 ? (
            <Button variant="ghost" onClick={() => setDeletingTemplate(null)}>
              {TEMPLATES.close}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setDeletingTemplate(null)}>
                {SERIES.keep}
              </Button>
              <Button variant="danger" loading={busy} onClick={() => deletingTemplate && deleteTemplate(deletingTemplate)}>
                {TEMPLATES.deleteConfirm}
              </Button>
            </>
          )
        }
      >
        {templatesInUse > 0 ? TEMPLATES.inUse(templatesInUse) : TEMPLATES.deleteBody}
      </Modal>
      <Modal
        open={deletingSeries !== null}
        onClose={() => setDeletingSeries(null)}
        title={SERIES.deleteTitle}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeletingSeries(null)}>
              {SERIES.keep}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => deletingSeries && deleteSeries(deletingSeries)}>
              {SERIES.deleteConfirm}
            </Button>
          </>
        }
      >
        {SERIES.deleteBody}
      </Modal>
    </div>
  );
}

/** "8:00 PM guild · 11:00 PM yours" for a weekly slot, from its next occurrence so DST is judged on a real date. */
function SeriesTime({ weekday, startTime }: { weekday: number; startTime: string }) {
  const viewer = useViewerTimeZone();
  if (!viewer || viewer.zone === GUILD_TIMEZONE) return <>{formatGuildClock(startTime)} {SERIES.guild}</>;
  const next = nextOccurrence(weekday as Weekday, startTime, GUILD_TIMEZONE, new Date());
  return (
    <>
      {formatGuildClock(startTime)} {SERIES.guild} · {formatClock(next, viewer.zone)} {SERIES.yours}
    </>
  );
}
