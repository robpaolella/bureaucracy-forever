/**
 * The helper's award upload (ADDON-SPEC 7.1, `POST /api/helper/operations`): the add-on's saved
 * operations, recorded with the batch writer and answered one result per operation, in order.
 */
import 'server-only';

import { writeOperationBatch } from '@/lib/addon-batch';
import { parseOperation, type Operation, type Outcome, type SiteEnv } from '@/lib/addon-operations';
import { HELPER_LIMITS } from '@/lib/helper-api';

/** `id` is null only for a record whose own id couldn't be read. */
export type UploadResult = { id: string | null } & (Outcome | { status: 'rejected'; code: 'bad-record' | 'unsupported-version' });
type Entry = { op: Operation } | { result: UploadResult };
export type ParsedUpload = { ok: true; entries: Entry[] } | { ok: false; status: 400 | 413; code: string; error: string };

/**
 * The body `{ operations: [...] }`. A body of the wrong shape or over the operations limit is
 * refused whole; a record that fails section 8.4 is answered `rejected` alone, so the rest still land.
 */
export function parseUpload(body: unknown): ParsedUpload {
  const operations = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as { operations?: unknown }).operations : undefined;
  if (!Array.isArray(operations)) return { ok: false, status: 400, code: 'bad-request', error: 'Send the records as { "operations": [ ... ] }.' };
  if (operations.length > HELPER_LIMITS.operations) {
    return { ok: false, status: 413, code: 'too-large', error: `Send at most ${HELPER_LIMITS.operations} records at a time.` };
  }
  return {
    ok: true,
    entries: operations.map((input): Entry => {
      const parsed = parseOperation(input);
      if (parsed.ok) return { op: parsed.value };
      const id = (input as { id?: unknown } | null)?.id;
      return { result: { id: typeof id === 'string' ? id : null, status: 'rejected', code: parsed.code ?? 'bad-record' } };
    }),
  };
}

/**
 * Writes the readable records, one batch per raid they name (in the order each raid first
 * appears, keeping each raid's records in upload order), as the key's officer. Each raid's batch
 * is its own transaction: if a later one fails, the earlier stay recorded and a retry replays them.
 */
export async function recordUpload(entries: Entry[], { env, officerId, receivedAt }: { env: SiteEnv; officerId: string; receivedAt: Date }): Promise<UploadResult[]> {
  const byRaid = new Map<string, number[]>();
  entries.forEach((entry, i) => {
    if ('op' in entry) byRaid.set(entry.op.raid, [...(byRaid.get(entry.op.raid) ?? []), i]);
  });
  const results = entries.map((entry) => ('result' in entry ? entry.result : null));
  for (const [raidId, indexes] of byRaid) {
    const operations = indexes.map((i) => (entries[i] as { op: Operation }).op);
    const written = await writeOperationBatch({ raidId, operations, env, officerId, receivedAt, via: 'helper' });
    indexes.forEach((i, n) => { results[i] = written[n]; });
  }
  return results as UploadResult[];
}
