/**
 * The officer applications inbox (docs/04 § Applications inbox, § Application detail).
 * Pure filtering and selection over the summaries the page loads, so the client component
 * stays a thin shell and the rules are unit-tested.
 */
import type { ApplicationPath } from '@/components/recruitment/form-state';
import type { WowClass } from '@/lib/design/class-colors';

export type AppStatus = 'pending' | 'accepted' | 'declined';

export type InboxItem = {
  id: string;
  path: ApplicationPath;
  status: AppStatus;
  character: string;
  wowClass: WowClass | null;
  spec: string | null;
  /** The handle typed, or the session name when the applicant was logged in. */
  discordName: string;
  createdAt: string;
  unread: boolean;
};

export type InboxFilters = {
  path: ApplicationPath | 'all';
  status: AppStatus | 'all';
  search: string;
};

/** docs/04: default is Raider + Pending. */
export const DEFAULT_FILTERS: InboxFilters = { path: 'raider', status: 'pending', search: '' };

export function filterInbox(items: InboxItem[], f: InboxFilters): InboxItem[] {
  const q = f.search.trim().toLowerCase();
  return items.filter(
    (a) =>
      (f.path === 'all' || a.path === f.path) &&
      (f.status === 'all' || a.status === f.status) &&
      (!q || a.character.toLowerCase().includes(q) || a.discordName.toLowerCase().includes(q) || (a.spec ?? '').toLowerCase().includes(q)),
  );
}

export function countActiveInboxFilters(f: InboxFilters): number {
  return (f.path !== DEFAULT_FILTERS.path ? 1 : 0) + (f.status !== DEFAULT_FILTERS.status ? 1 : 0) + (f.search.trim() ? 1 : 0);
}

/** The row to open on a fresh load: the requested one if it exists, else the first pending, else the first shown. */
export function defaultSelection(shown: InboxItem[], requested: string | null): string | null {
  if (requested && shown.some((a) => a.id === requested)) return requested;
  return shown.find((a) => a.status === 'pending')?.id ?? shown[0]?.id ?? null;
}

/**
 * What the inbox page opens: an explicitly requested application whatever its path or
 * status (the detail page's back link relies on this), else the first pending raider,
 * else the newest of anything.
 */
export function selectApplication(items: InboxItem[], requested: string | null): string | null {
  if (requested && items.some((a) => a.id === requested)) return requested;
  return defaultSelection(sortInbox(filterInbox(items, DEFAULT_FILTERS)), null) ?? defaultSelection(sortInbox(items), null);
}

/** Newest first, for the list. */
export function sortInbox(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export const STATUS_LABEL: Record<AppStatus, string> = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined' };
export const STATUS_TONE: Record<AppStatus, 'warn' | 'ok' | 'stop'> = { pending: 'warn', accepted: 'ok', declined: 'stop' };
export const PATH_LABEL: Record<ApplicationPath, string> = { raider: 'Raider', social: 'Social' };

/** The answer keys the form writes, in display order, with their questions. */
export const QUESTIONS: { key: string; label: string }[] = [
  { key: 'availability', label: 'Can you make the progression nights?' },
  { key: 'wipe', label: 'A wipe you caused and what you changed' },
  { key: 'note', label: 'Anything we should know?' },
];

export function orderedAnswers(answers: unknown): { key: string; label: string; answer: string }[] {
  const a = (answers && typeof answers === 'object' ? answers : {}) as Record<string, unknown>;
  const known = QUESTIONS.filter((q) => typeof a[q.key] === 'string' && (a[q.key] as string).trim()).map((q) => ({ ...q, answer: a[q.key] as string }));
  const extra = Object.keys(a)
    .filter((k) => !QUESTIONS.some((q) => q.key === k) && typeof a[k] === 'string' && (a[k] as string).trim())
    .map((k) => ({ key: k, label: k, answer: a[k] as string }));
  return [...known, ...extra];
}

/** Tailwind's `lg`, where the inbox shows its right pane (`hidden lg:block`). Keep in step with tailwind.config.ts. */
export const INBOX_PANE_MIN_WIDTH = 1024;

export type RowClick = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; wide: boolean };

/**
 * Whether a click on an inbox row should open the application as its own page instead of
 * following the row's `?id=` link. Only a plain primary click below the pane breakpoint:
 * with a modifier or another button the browser's own behaviour wins, as Next's Link does.
 */
export function opensStandalone(click: RowClick): boolean {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  return !click.wide;
}

/** The list with the open application's unread dot already cleared, since the page marks it read as it renders. */
export function withSelectedRead(items: InboxItem[], selectedId: string | null): InboxItem[] {
  return selectedId ? items.map((a) => (a.id === selectedId && a.unread ? { ...a, unread: false } : a)) : items;
}
