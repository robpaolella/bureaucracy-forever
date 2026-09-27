/**
 * Officer inputs for raid templates and series (SYNC-SPEC §3, §9.3). Pure validation shared
 * by the routes and the forms.
 */
import { parseRequirements, totalCounts, type RoleCounts } from '@/lib/raids';

export type TemplateInput = { name: string; short: string; size: number; durationMin: number; requirements: RoleCounts; active: boolean };
export type SeriesInput = { templateId: string; weekday: number; startTime: string; durationMin: number; notes: string; postAheadDays: number; lockMinutesBefore: number; horizonWeeks: number; active: boolean };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const int = (v: unknown) => (typeof v === 'number' ? v : Number(v));
const inRange = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;

export function parseTemplateInput(body: unknown): Parsed<TemplateInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 60) return { ok: false, error: 'Give the template a name under 60 characters.' };
  const short = typeof b.short === 'string' ? b.short.trim() : '';
  if (!short || short.length > 8) return { ok: false, error: 'The short name is 1 to 8 characters.' };
  const size = int(b.size);
  if (!inRange(size, 5, 40)) return { ok: false, error: 'Size is 5 to 40.' };
  const durationMin = int(b.durationMin);
  if (!inRange(durationMin, 30, 480) || durationMin % 15 !== 0) return { ok: false, error: 'Length is 30 to 480 minutes, in quarter hours.' };
  const requirements = parseRequirements(b.requirements);
  if (totalCounts(requirements) !== size) return { ok: false, error: `The four requirements must add up to ${size}.` };
  return { ok: true, value: { name, short, size, durationMin, requirements, active: b.active !== false } };
}

export function parseSeriesInput(body: unknown): Parsed<SeriesInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const templateId = typeof b.templateId === 'string' && b.templateId ? b.templateId : '';
  if (!templateId) return { ok: false, error: 'Pick a template.' };
  const weekday = int(b.weekday);
  if (!inRange(weekday, 0, 6)) return { ok: false, error: 'Pick a weekday.' };
  const startTime = typeof b.startTime === 'string' ? b.startTime : '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return { ok: false, error: 'Start is HH:MM in guild time.' };
  const durationMin = int(b.durationMin);
  if (!inRange(durationMin, 30, 480) || durationMin % 15 !== 0) return { ok: false, error: 'Length is 30 to 480 minutes, in quarter hours.' };
  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 500) : '';
  const postAheadDays = b.postAheadDays === undefined ? 14 : int(b.postAheadDays);
  if (!inRange(postAheadDays, 1, 60)) return { ok: false, error: 'Post ahead is 1 to 60 days.' };
  const lockMinutesBefore = b.lockMinutesBefore === undefined ? 120 : int(b.lockMinutesBefore);
  if (!inRange(lockMinutesBefore, 0, 1440)) return { ok: false, error: 'Lock is 0 to 1440 minutes before the start.' };
  const horizonWeeks = b.horizonWeeks === undefined ? 4 : int(b.horizonWeeks);
  if (!inRange(horizonWeeks, 1, 12)) return { ok: false, error: 'Horizon is 1 to 12 weeks.' };
  return { ok: true, value: { templateId, weekday, startTime, durationMin, notes, postAheadDays, lockMinutesBefore, horizonWeeks, active: b.active !== false } };
}

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
