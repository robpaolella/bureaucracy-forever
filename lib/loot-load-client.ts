import { allItemIds, parseIdsFile, type ParsedTable } from './loot-import';
import type { ItemSource } from './loot-rules';

type Fetcher = typeof fetch;
type FailedItem = { id: number; error: string };
type Preview = {
  token: string;
  bosses: { bossId: string | null; name: string; isTrash: boolean; isNew: boolean; add: number[]; already: number[]; notFound: number[] }[];
  added: number;
  newBosses: number;
};

type Upload = Pick<File, 'name' | 'text'>;
export type LoadFile = { name: string; file: ParsedTable; total: number };
export type ReadFileResult = { ok: true; value: LoadFile } | { ok: false; error: string };
export type PreviewResult =
  | { kind: 'preview'; preview: Preview; failed: FailedItem[]; nothingToChange: boolean }
  | { kind: 'stopped' }
  | { kind: 'error'; error: string };
export type ApplyResult =
  | { kind: 'success'; added: number; newBosses: number }
  | { kind: 'stale'; error: string; hint: string }
  | { kind: 'error'; error: string }
  | { kind: 'save-failed' };

const INVALID_FILE = "This file isn't a loot list: ";
const UNREACHABLE = "Couldn't reach the site — try again.";
const STALE = 'The table changed since this preview.';
const STALE_HINT = 'Preview again to see the current changes.';
const SAVE_FAILED = "Couldn't save that — try again.";

function invalidFile(reason: string) {
  return `${INVALID_FILE}${reason}`;
}

/** Reads a browser file once, then validates the same parsed value that the routes receive. */
export async function readLoadFile(upload: Upload): Promise<ReadFileResult> {
  let text: string;
  try {
    text = await upload.text();
  } catch {
    return { ok: false, error: invalidFile("couldn't read this file.") };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: invalidFile("it isn't valid JSON.") };
  }
  try {
    const file = parseIdsFile(json);
    return { ok: true, value: { name: upload.name, file, total: allItemIds(file).length } };
  } catch (error) {
    return { ok: false, error: invalidFile((error as Error).message) };
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

function request(fetcher: Fetcher, url: string, body: unknown) {
  return fetcher(url, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

/** Runs every preview batch. Calling it again retries prior failures because it begins with an empty skip list. */
export async function previewLoadTable(options: {
  templateId: string; loadFile: LoadFile; source?: ItemSource; onProgress?: (progress: { completed: number; total: number }) => void;
  stopped?: () => boolean; fetcher?: Fetcher;
}): Promise<PreviewResult> {
  const { templateId, loadFile, source = 'FOREVER', onProgress, stopped = () => false, fetcher = fetch } = options;
  const failed = new Map<number, FailedItem>();
  let skip: number[] = [];
  while (true) {
    if (stopped()) return { kind: 'stopped' };
    let response: Response;
    try {
      response = await request(fetcher, `/api/loot/tables/${templateId}/preview`, { file: loadFile.file, source, skip });
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
    return { kind: 'preview', preview: json.preview, failed: [...failed.values()], nothingToChange: json.preview.added === 0 && json.preview.newBosses === 0 };
  }
}

function isPreview(value: unknown): value is Preview {
  return !!value && typeof value === 'object' && typeof (value as Preview).token === 'string' &&
    typeof (value as Preview).added === 'number' && typeof (value as Preview).newBosses === 'number' && Array.isArray((value as Preview).bosses);
}

/** Applies exactly a completed preview. A failed save intentionally leaves that preview available to retry. */
export async function applyLoadTable(options: {
  templateId: string; loadFile: LoadFile; token: string; source?: ItemSource; fetcher?: Fetcher;
}): Promise<ApplyResult> {
  const { templateId, loadFile, token, source = 'FOREVER', fetcher = fetch } = options;
  let response: Response;
  try {
    response = await request(fetcher, `/api/loot/tables/${templateId}/apply`, { file: loadFile.file, source, token, sourceName: loadFile.name });
  } catch {
    return { kind: 'save-failed' };
  }
  const json = await responseJson(response);
  if (response.status === 409) return { kind: 'stale', error: STALE, hint: STALE_HINT };
  if (response.status >= 500 || !json) return { kind: 'save-failed' };
  if (!response.ok) return { kind: 'error', error: routeError(json) };
  if (typeof json.added !== 'number' || typeof json.newBosses !== 'number') return { kind: 'save-failed' };
  return { kind: 'success', added: json.added, newBosses: json.newBosses };
}

export const LOAD_TABLE_MESSAGES = { INVALID_FILE, UNREACHABLE, STALE, STALE_HINT, SAVE_FAILED };
