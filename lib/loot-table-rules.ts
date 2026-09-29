/**
 * Officer edits to a raid tier's loot table (/officers/loot/[templateId]). Pure validation
 * shared by the routes and the editor.
 */
import { parseItemRef, type ItemSource } from '@/lib/loot-rules';

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Items refreshed from Wowhead per click: about 33 s at one request per 1.1 s. */
export const REFRESH_BATCH = 30;

export type BossInput = { name?: string; isTrash?: boolean; move?: 'up' | 'down' };

/** A new boss needs a name; an edit may change any of name, trash and order. */
export function parseBossInput(body: unknown, creating: boolean): Parsed<BossInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: BossInput = {};
  if (b.name !== undefined || creating) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name || name.length > 60) return { ok: false, error: 'Give the boss a name under 60 characters.' };
    out.name = name;
  }
  if (b.isTrash !== undefined) {
    if (typeof b.isTrash !== 'boolean') return { ok: false, error: 'Trash is on or off.' };
    out.isTrash = b.isTrash;
  }
  if (b.move !== undefined) {
    if (b.move !== 'up' && b.move !== 'down') return { ok: false, error: 'Move up or down.' };
    out.move = b.move;
  }
  if (!creating && Object.keys(out).length === 0) return { ok: false, error: 'Nothing to change.' };
  return { ok: true, value: out };
}

/** `ids` in their new order after moving `id` one place up or down; unchanged at either end. */
export function moveId(ids: readonly string[], id: string, dir: 'up' | 'down'): string[] {
  const out = [...ids];
  const i = out.indexOf(id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** `explicit`: the link named its database, so it may replace a cached row from the other one. */
export type ItemInput = { id: number; source: ItemSource; explicit: boolean };

/** "Add item": an id or Wowhead link. A link that names its database wins over the picker. */
export function parseItemInput(body: unknown): Parsed<ItemInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const ref = typeof b.ref === 'string' ? parseItemRef(b.ref) : null;
  if (!ref) return { ok: false, error: 'Paste an item id or a Wowhead item link.' };
  const picked = b.source === 'CLASSIC' || b.source === 'FOREVER' ? b.source : null;
  const source = ref.source ?? picked;
  if (!source) return { ok: false, error: 'Pick Classic or Forever.' };
  return { ok: true, value: { id: ref.id, source, explicit: ref.source !== undefined } };
}
