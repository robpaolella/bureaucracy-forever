/**
 * Availability week maths (docs/05 § Shared model). 7 days × 48 half-hour slots, day 0 =
 * Monday, slot 0 = 00:00, slot 47 = 23:30. Slots are stored in the member's own zone with
 * the zone they painted in; nothing here is in guild time unless it says so.
 */
import { GUILD_TIMEZONE } from '@/lib/config';
import { tzOffsetMs, zonedParts, zonedTimeToUtc } from '@/lib/time';

export const DAYS = 7;
export const SLOTS = 48;
export const SLOT_STATES = ['available', 'if-needed'] as const;
export type SlotState = (typeof SLOT_STATES)[number];
/** Absence of a key = not available. */
export type Week = Record<string, SlotState>;

export type PaintMode = SlotState | 'erase';

export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function slotKey(day: number, slot: number): string {
  return `${day}:${slot}`;
}

export function parseKey(key: string): { day: number; slot: number } | null {
  const m = /^([0-6]):([0-9]|[1-3][0-9]|4[0-7])$/.exec(key);
  return m ? { day: Number(m[1]), slot: Number(m[2]) } : null;
}

/** Type guard for a week as stored or received: valid keys, valid states, nothing else. */
export function isWeek(value: unknown): value is Week {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > DAYS * SLOTS) return false;
  return entries.every(([k, v]) => parseKey(k) !== null && (SLOT_STATES as readonly unknown[]).includes(v));
}

/** Keep only valid entries. Used when reading rows written by older code. */
export function normalizeWeek(value: unknown): Week {
  const week: Week = {};
  if (!value || typeof value !== 'object') return week;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (parseKey(k) && (SLOT_STATES as readonly unknown[]).includes(v)) week[k] = v as SlotState;
  }
  return week;
}

export function countStates(week: Week): { available: number; ifNeeded: number } {
  let available = 0;
  let ifNeeded = 0;
  for (const v of Object.values(week)) {
    if (v === 'available') available++;
    else ifNeeded++;
  }
  return { available, ifNeeded };
}

/** Apply a paint mode to one cell, immutably. Erase removes the key. */
export function applyPaint(week: Week, key: string, mode: PaintMode): Week {
  if (mode === 'erase') {
    if (!(key in week)) return week;
    const next = { ...week };
    delete next[key];
    return next;
  }
  if (week[key] === mode) return week;
  return { ...week, [key]: mode };
}

/** Paint a run of slots on one day, immutably. */
export function applyPaintRun(week: Week, day: number, fromSlot: number, toSlot: number, mode: PaintMode): Week {
  const [a, b] = fromSlot <= toSlot ? [fromSlot, toSlot] : [toSlot, fromSlot];
  let next = week;
  for (let s = Math.max(0, a); s <= Math.min(SLOTS - 1, b); s++) next = applyPaint(next, slotKey(day, s), mode);
  return next;
}

/**
 * A run of same-state slots on one day, as the editor draws it. `end` is exclusive, so a
 * block running to midnight has `end` = SLOTS and a half-hour block has `end` = `start` + 1.
 */
export type Block = { day: number; start: number; end: number; state: SlotState };

/** A day's blocks, top to bottom. A gap or a change of state starts a new block. */
export function dayBlocks(week: Week, day: number): Block[] {
  const blocks: Block[] = [];
  for (let slot = 0; slot < SLOTS; slot++) {
    const state = week[slotKey(day, slot)];
    if (!state) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.end === slot && last.state === state) last.end = slot + 1;
    else blocks.push({ day, start: slot, end: slot + 1, state });
  }
  return blocks;
}

/** The block covering a slot, or null for an empty slot. */
export function blockAt(week: Week, day: number, slot: number): Block | null {
  return dayBlocks(week, day).find((b) => slot >= b.start && slot < b.end) ?? null;
}

/** The week a set of blocks describes; the inverse of grouping every day. */
export function weekFromBlocks(blocks: Block[]): Week {
  let week: Week = {};
  for (const b of blocks) week = applyPaintRun(week, b.day, b.start, b.end - 1, b.state);
  return week;
}

/**
 * Move one edge of a block to a new boundary, in half-hour steps, immutably. The edge stops
 * one half-hour short of the other edge and at the day's ends. Growing paints the block's
 * state, so it merges with a same-state block and takes slots from the other state;
 * shrinking clears the slots it leaves. Pass a block grouped from this same week; a stale
 * block paints or clears slots that no longer match it.
 */
export function resizeBlock(week: Week, block: Block, edge: 'start' | 'end', to: number): Week {
  const { day, start, end, state } = block;
  // applyPaintRun swaps a reversed range, so an unmoved edge must return before it.
  if (edge === 'start') {
    const next = Math.min(Math.max(0, to), end - 1);
    if (next === start) return week;
    return next < start ? applyPaintRun(week, day, next, start - 1, state) : applyPaintRun(week, day, start, next - 1, 'erase');
  }
  const next = Math.max(Math.min(SLOTS, to), start + 1);
  if (next === end) return week;
  return next > end ? applyPaintRun(week, day, end, next - 1, state) : applyPaintRun(week, day, next, end - 1, 'erase');
}

/**
 * One step of an edge drag to the boundary `to` nearest the pointer. Pass the week and block
 * as they were when the drag began, so pulling back past another block restores it. Returns
 * the new week and the block now holding the fixed edge, which stays selected; after a
 * merge it is the merged block.
 */
export function dragEdge(week: Week, block: Block, edge: 'start' | 'end', to: number): { week: Week; block: Block } {
  const next = resizeBlock(week, block, edge, to);
  const fixed = edge === 'end' ? block.start : block.end - 1;
  return { week: next, block: blockAt(next, block.day, fixed) ?? block };
}

/** Whether two blocks are the same run, e.g. a selection and a block on the grid. */
export function sameBlock(a: Block | null, b: Block | null): boolean {
  return !!a && !!b && a.day === b.day && a.start === b.start && a.end === b.end && a.state === b.state;
}

/** Clear exactly a block's slots, immutably. Pass a block grouped from this same week. */
export function removeBlock(week: Week, block: Block): Week {
  return applyPaintRun(week, block.day, block.start, block.end - 1, 'erase');
}

export const STATE_WORD: Record<SlotState, string> = { available: 'Available', 'if-needed': 'If needed' };

function isAllDay(block: Block): boolean {
  return block.start === 0 && block.end === SLOTS;
}

/** The range printed in a block: "7:00 – 11:00 PM", "11:00 PM – 12:00 AM", "All day". */
export function blockRange(block: Block): string {
  if (isAllDay(block)) return 'All day';
  const [from, fromHalf] = fmtSlot(block.start).split(' ');
  const [to, toHalf] = fmtSlot(block.end).split(' ');
  return fromHalf === toHalf && block.end < SLOTS ? `${from} – ${to} ${toHalf}` : `${from} ${fromHalf} – ${to} ${toHalf}`;
}

/** What a screen reader hears for a block: "Available, Tuesday 7:00 PM to 11:00 PM". */
export function blockLabel(block: Block): string {
  const when = isAllDay(block) ? 'all day' : `${fmtSlot(block.start)} to ${fmtSlot(block.end)}`;
  return `${STATE_WORD[block.state]}, ${DAY_LONG[block.day]} ${when}`;
}

/** The remove button's label: "Remove available 7:00 – 11:00 PM". */
export function blockRemoveLabel(block: Block): string {
  const range = isAllDay(block) ? 'all day' : blockRange(block);
  return `Remove ${STATE_WORD[block.state].toLowerCase()} ${range}`;
}

/** "8:30 PM". Slots wrap, so a guild-time label past midnight reads correctly. */
export function fmtSlot(slot: number): string {
  const i = ((slot % SLOTS) + SLOTS) % SLOTS;
  const h = Math.floor(i / 2);
  const m = i % 2 ? '30' : '00';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The aria-label for a cell: "Tue 8:30 PM". */
export function cellLabel(day: number, slot: number): string {
  return `${DAY_SHORT[day]} ${fmtSlot(slot)}`;
}

/** Monday-first day index from a JS weekday (Sunday = 0). */
export function mondayIndex(jsWeekday: number): number {
  return (jsWeekday + 6) % 7;
}

/** The instant at which the current week's Monday begins (00:00) in `zone`. */
export function weekStart(now: Date, zone: string): Date {
  const p = zonedParts(now, zone);
  const back = mondayIndex(p.weekday);
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - back));
  return zonedTimeToUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), 0, 0, zone);
}

/**
 * When a slot of the week containing `now` starts, as `zone`'s clocks read it (day 0 =
 * Monday), so a label built from it always reads `fmtSlot(slot)` in `zone`. A gutter row
 * stands for every day and uses day 0, which carries the week-start offset `guildOffsetSlots`
 * uses; a later day in a week with a DST change gets that day's real guild time.
 */
export function slotStartsAt(now: Date, zone: string, day: number, slot: number): string {
  const monday = zonedParts(weekStart(now, zone), zone);
  return zonedTimeToUtc(monday.year, monday.month, monday.day + day, Math.floor(slot / 2), (slot % 2) * 30, zone).toISOString();
}

export type WeekDay = { day: number; name: (typeof DAY_SHORT)[number]; longName: (typeof DAY_LONG)[number]; date: string; isToday: boolean };

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The seven column headers for the week containing `now`, labelled in `zone`: "Tue", "4 Nov". */
export function weekDays(now: Date, zone: string): WeekDay[] {
  const start = weekStart(now, zone);
  const today = mondayIndex(zonedParts(now, zone).weekday);
  return Array.from({ length: DAYS }, (_, day) => {
    // Noon avoids any DST edge on the day itself.
    const p = zonedParts(new Date(start.getTime() + day * 86_400_000 + 12 * 3_600_000), zone);
    return { day, name: DAY_SHORT[day], longName: DAY_LONG[day], date: `${p.day} ${MONTH_SHORT[p.month - 1]}`, isToday: day === today };
  });
}

/**
 * How many half-hour slots the guild clock is ahead of `zone` at `at`. Positive = guild
 * time is ahead. The grid passes the week's start, so a week straddling a DST change carries one
 * offset for its whole width, as the artboard does. Zones on quarter-hour offsets round to
 * the nearest half-hour.
 */
export function guildOffsetSlots(at: Date, zone: string): number {
  return Math.round((tzOffsetMs(at, GUILD_TIMEZONE) - tzOffsetMs(at, zone)) / 1_800_000);
}

/** "2 hours ahead", "same time", "5½ hours behind". */
export function offsetDescription(offsetSlots: number): string {
  if (offsetSlots === 0) return 'same time';
  const abs = Math.abs(offsetSlots);
  const hours = Math.floor(abs / 2);
  const half = abs % 2 === 1;
  const amount = hours === 0 ? '½' : half ? `${hours}½` : String(hours);
  const unit = (hours === 1 && !half) || hours === 0 ? 'hour' : 'hours';
  return `${amount} ${unit} ${offsetSlots > 0 ? 'ahead' : 'behind'}`;
}

export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.length === 0 || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** "just now", "4 minutes ago", "2 hours ago". */
export function relativeTime(then: Date, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
