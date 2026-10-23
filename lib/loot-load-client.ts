import type { BossNameCheck } from './encounter-ids';
import { allItemIds, parseIdsFile, type AtlasRaid, type ParsedTable } from './loot-import';
import type { ItemSource } from './loot-rules';

type Fetcher = typeof fetch;
type FailedItem = { id: number; error: string };
type Preview = {
  token: string;
  bosses: {
    bossId: string | null; name: string; isTrash: boolean; isNew: boolean; add: number[]; already: number[]; notFound: number[];
    /** Replace only; empty, or null for absent, in a merge. */
    remove: number[]; kept: { id: number; has: 'awards' | 'reserves' }[]; absent: 'remove' | 'keep' | null;
  }[];
  added: number;
  newBosses: number;
  removed: number;
  removedBosses: number;
  kept: number;
};

/** What the preview lists for an item to add; ids missing here show as their number. */
export type PreviewItem = { id: number; name: string; quality: number; icon: string };

type Upload = Pick<File, 'name' | 'text'>;
export type LoadFile = { name: string; file: ParsedTable; total: number };
export type ReadFileResult = { ok: true; value: LoadFile } | { ok: false; error: string };
export type PreviewResult =
  | { kind: 'preview'; preview: Preview; items: PreviewItem[]; failed: FailedItem[]; nothingToChange: boolean; bossCheck: BossNameCheck | null }
  | { kind: 'stopped' }
  | { kind: 'error'; error: string };
export type ApplyResult =
  | { kind: 'success'; added: number; newBosses: number; removed: number }
  | { kind: 'stale'; error: string; hint: string }
  | { kind: 'error'; error: string }
  | { kind: 'save-failed' };

// Typographic quotes, as the approved design (#203) shows them.
const INVALID_FILE = 'This file isn’t a loot list: ';
const UNREACHABLE = 'Couldn’t reach the site — try again.';
const STALE = 'The table changed since this preview.';
const STALE_HINT = 'Preview again to see the current changes.';
const SAVE_FAILED = 'Couldn’t save that — try again.';

function invalidFile(reason: string) {
  return `${INVALID_FILE}${reason.replace(/"([^"]*)"/g, '“$1”')}`;
}

/** Reads a browser file once, then validates the same parsed value that the routes receive. */
export async function readLoadFile(upload: Upload): Promise<ReadFileResult> {
  let text: string;
  try {
    text = await upload.text();
  } catch {
    return { ok: false, error: invalidFile('couldn’t read this file.') };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: invalidFile('it isn’t valid JSON.') };
  }
  try {
    const file = parseIdsFile(json);
    return { ok: true, value: { name: upload.name, file, total: allItemIds(file).length } };
  } catch (error) {
    return { ok: false, error: invalidFile((error as Error).message) };
  }
}

export type AtlasRaidsResult =
  | { kind: 'ready'; raids: AtlasRaid[]; source: ItemSource }
  | { kind: 'off' }
  | { kind: 'error'; error: string };
/** `missing`: the server has no such raid, so asking again for the same one cannot work. */
export type AtlasTableResult = { kind: 'ok'; value: LoadFile; source: ItemSource } | { kind: 'error'; error: string; missing?: boolean };

const isSource = (value: unknown): value is ItemSource => value === 'FOREVER' || value === 'CLASSIC';
const isRaid = (value: unknown): value is AtlasRaid =>
  !!value && typeof value === 'object' && typeof (value as AtlasRaid).key === 'string' && typeof (value as AtlasRaid).name === 'string';

/** AtlasLoot's raids, from the server. Where the data lives is the server's setting; the browser never knows it. */
export async function loadAtlasRaids(fetcher: Fetcher = fetch): Promise<AtlasRaidsResult> {
  let response: Response;
  try {
    response = await fetcher('/api/loot/atlasloot', { credentials: 'same-origin' });
  } catch {
    return { kind: 'error', error: UNREACHABLE };
  }
  const json = await responseJson(response);
  if (!response.ok) return { kind: 'error', error: routeError(json) };
  if (!json || !isSource(json.source)) return { kind: 'error', error: UNREACHABLE };
  if (json.off === true) return { kind: 'off' };
  if (!Array.isArray(json.raids)) return { kind: 'error', error: UNREACHABLE };
  return { kind: 'ready', raids: json.raids.filter(isRaid), source: json.source };
}

/** One raid's table. Sends the raid key only; the result is the same LoadFile a chosen file makes. */
export function fetchAtlasTable(raidKey: string, fetcher: Fetcher = fetch): Promise<AtlasTableResult> {
  return fetchTable(fetcher, '/api/loot/atlasloot', { raidKey });
}

/** foreverchanges.pro's dungeons, as the same key/name list the raid choice uses (the key is the slug). */
export async function loadForeverDungeons(fetcher: Fetcher = fetch): Promise<AtlasRaidsResult> {
  let response: Response;
  try {
    response = await fetcher('/api/loot/foreverchanges', { credentials: 'same-origin' });
  } catch {
    return { kind: 'error', error: UNREACHABLE };
  }
  const json = await responseJson(response);
  if (!response.ok) return { kind: 'error', error: routeError(json) };
  if (!json || !Array.isArray(json.dungeons)) return { kind: 'error', error: UNREACHABLE };
  const dungeons = json.dungeons.flatMap((d: unknown) => {
    const { slug, name } = (d && typeof d === 'object' ? d : {}) as { slug?: unknown; name?: unknown };
    return typeof slug === 'string' && typeof name === 'string' ? [{ key: slug, name }] : [];
  });
  return { kind: 'ready', raids: dungeons, source: 'FOREVER' };
}

/** One dungeon's table, by slug only. */
export function fetchForeverTable(slug: string, fetcher: Fetcher = fetch): Promise<AtlasTableResult> {
  return fetchTable(fetcher, '/api/loot/foreverchanges', { slug });
}

async function fetchTable(fetcher: Fetcher, url: string, body: unknown): Promise<AtlasTableResult> {
  let response: Response;
  try {
    response = await request(fetcher, url, body);
  } catch {
    return { kind: 'error', error: UNREACHABLE };
  }
  const json = await responseJson(response);
  if (!response.ok) return { kind: 'error', error: routeError(json), ...(response.status === 404 && { missing: true }) };
  if (!json || !isSource(json.source) || typeof json.name !== 'string') return { kind: 'error', error: UNREACHABLE };
  try {
    const file = parseIdsFile(json.file);
    return { kind: 'ok', source: json.source, value: { name: json.name, file, total: allItemIds(file).length } };
  } catch {
    return { kind: 'error', error: UNREACHABLE };
  }
}

async function responseJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const json: unknown = await response.json();
    return json && typeof json === 'object' ? json as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function routeError(json: Record<string, unknown> | null) {
  return typeof json?.error === 'string' ? json.error : UNREACHABLE;
}

/** The routes parse the importer's format again, so send that, not the parsed table. */
export function toIdsFile(file: ParsedTable) {
  return { bosses: file.bosses.map((boss) => ({ name: boss.name, trash: boss.isTrash, items: boss.itemIds })) };
}

function request(fetcher: Fetcher, url: string, body: unknown) {
  return fetcher(url, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

/** Runs every preview batch. Calling it again retries prior failures because it begins with an empty skip list. */
export async function previewLoadTable(options: {
  templateId: string; loadFile: LoadFile; source?: ItemSource; onProgress?: (progress: { completed: number; total: number }) => void;
  stopped?: () => boolean; fetcher?: Fetcher; replace?: boolean; checkNames?: boolean;
}): Promise<PreviewResult> {
  const { templateId, loadFile, source = 'FOREVER', onProgress, stopped = () => false, fetcher = fetch, replace = false, checkNames = false } = options;
  const failed = new Map<number, FailedItem>();
  let skip: number[] = [];
  while (true) {
    if (stopped()) return { kind: 'stopped' };
    let response: Response;
    try {
      response = await request(fetcher, `/api/loot/tables/${templateId}/preview`, { file: toIdsFile(loadFile.file), source, skip, replace, ...(checkNames && { checkNames }) });
    } catch {
      return { kind: 'error', error: UNREACHABLE };
    }
    const json = await responseJson(response);
    if (!response.ok) return { kind: 'error', error: routeError(json) };
    if (!json || typeof json.remaining !== 'number' || !Array.isArray(json.skip)) return { kind: 'error', error: UNREACHABLE };
    const latest = Array.isArray(json.failed) ? json.failed : [];
    latest.forEach((item) => {
      if (item && typeof item === 'object' && Number.isSafeInteger((item as FailedItem).id) && typeof (item as FailedItem).error === 'string') {
        failed.set((item as FailedItem).id, item as FailedItem);
      }
    });
    skip = json.skip.filter((id): id is number => Number.isSafeInteger(id));
    onProgress?.({ completed: loadFile.total - json.remaining, total: loadFile.total });
    if (stopped()) return { kind: 'stopped' };
    if (json.remaining > 0) continue;
    if (!isPreview(json.preview)) return { kind: 'error', error: UNREACHABLE };
    const items = Array.isArray(json.items) ? json.items.filter(isPreviewItem) : [];
    const { added, newBosses, removed, removedBosses } = json.preview;
    return { kind: 'preview', preview: json.preview, items, failed: [...failed.values()], nothingToChange: added + newBosses + removed + removedBosses === 0, bossCheck: checkNames && isBossCheck(json.bossCheck) ? json.bossCheck : null };
  }
}

function isBossCheck(value: unknown): value is BossNameCheck {
  const check = value as BossNameCheck;
  if (!check || typeof check !== 'object') return false;
  if (check.kind === 'unchecked') return check.reason === 'no-instance' || check.reason === 'not-listed';
  const names = (list: unknown) => Array.isArray(list) && list.every((name) => typeof name === 'string');
  return check.kind === 'checked' && names(check.flagged) && names(check.unmatched);
}

function isPreviewItem(value: unknown): value is PreviewItem {
  const item = value as PreviewItem;
  return !!item && typeof item === 'object' && Number.isSafeInteger(item.id) && typeof item.name === 'string' &&
    typeof item.quality === 'number' && typeof item.icon === 'string';
}

function isPreview(value: unknown): value is Preview {
  const preview = value as Preview;
  return !!preview && typeof preview === 'object' && typeof preview.token === 'string' && Array.isArray(preview.bosses) &&
    [preview.added, preview.newBosses, preview.removed, preview.removedBosses, preview.kept].every((n) => typeof n === 'number');
}

/** Applies exactly a completed preview. A failed save intentionally leaves that preview available to retry. */
export async function applyLoadTable(options: {
  templateId: string; loadFile: LoadFile; token: string; source?: ItemSource; fetcher?: Fetcher; replace?: boolean;
}): Promise<ApplyResult> {
  const { templateId, loadFile, token, source = 'FOREVER', fetcher = fetch, replace = false } = options;
  let response: Response;
  try {
    response = await request(fetcher, `/api/loot/tables/${templateId}/apply`, { file: toIdsFile(loadFile.file), source, token, sourceName: loadFile.name, replace });
  } catch {
    return { kind: 'save-failed' };
  }
  const json = await responseJson(response);
  if (response.status === 409 && json?.error === STALE) return { kind: 'stale', error: STALE, hint: STALE_HINT };
  if (response.status >= 500 || !json) return { kind: 'save-failed' };
  if (!response.ok) return { kind: 'error', error: routeError(json) };
  if (typeof json.added !== 'number' || typeof json.newBosses !== 'number' || typeof json.removed !== 'number') return { kind: 'save-failed' };
  return { kind: 'success', added: json.added, newBosses: json.newBosses, removed: json.removed };
}

export const LOAD_TABLE_MESSAGES = { INVALID_FILE, UNREACHABLE, STALE, STALE_HINT, SAVE_FAILED };
