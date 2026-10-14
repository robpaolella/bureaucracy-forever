import { NextResponse } from 'next/server';
import { writeOperationBatch } from '@/lib/addon-batch';
import { parseCopyout } from '@/lib/addon-copyout';
import type { AwardOperation, Operation } from '@/lib/addon-operations';
import { isStagingDeployment } from '@/lib/deploy-env';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/users';
import { requireLootOfficer } from '../../../../_loot';
import { NO_STORE } from '../../../../_officer';

/** ADDON-SPEC 7.6: the text is at most 64 KiB, applied 100 operations at a time. */
export const MAX_BYTES = 64 * 1024;
const BATCH = 100;
/** JSON can spell one byte of text as six (`\u00XX`), so that is the most a body may add before it can't fit. */
const MAX_BODY = MAX_BYTES * 6 + 1024;

const award = (op: Operation): AwardOperation | null => (op.type === 'award' ? op : op.type === 'replace' ? op.award : null);

/**
 * POST /api/raids/[id]/loot/import — record an add-on copy-out text (ADDON-SPEC 12), as the
 * importing officer and by the same rules as a helper upload. Body `{ text }`.
 *
 * The whole text is checked first; a refusal records nothing and answers 400
 * `{ error, code, line? }` with `code` 'unreadable-header' | 'wrong-raid' | 'wrong-environment' |
 * 'no-end-line' | 'count-mismatch' | 'malformed-line' (with `line`, the header being line 1).
 * More than 64 KiB answers 413. Otherwise 200 `{ results }`, one per operation in order:
 * `{ id, type, status: 'recorded' | 'replayed' | 'voided' | 'pending' | 'rejected', code?, item?, character? }`
 * with `item` and `character` (null for disenchant/bank) on an award, and on a replace for its new award.
 * Batches are separate transactions: if a later one fails (500), the earlier ones stay recorded and
 * pasting the same text again finishes the job, since repeats are `replayed`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const { id: raidId } = await params;
  if (!await db.raid.findUnique({ where: { id: raidId }, select: { id: true } })) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });

  const tooBig = () => NextResponse.json({ error: 'That text is too long to import.' }, { status: 413, headers: NO_STORE });
  if (Number(request.headers.get('content-length')) > MAX_BODY) return tooBig();
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  if (typeof body?.text !== 'string') return NextResponse.json({ error: 'Send the copied text as { text }.' }, { status: 400, headers: NO_STORE });
  if (new TextEncoder().encode(body.text).length > MAX_BYTES) return tooBig();

  const env = isStagingDeployment() ? 'staging' : 'production';
  const parsed = parseCopyout(body.text, raidId, env);
  if (!parsed.ok) {
    const refusal = parsed.code === 'malformed-line' ? { code: parsed.code, line: parsed.line } : { code: parsed.code };
    return NextResponse.json({ error: 'That text can’t be imported, so nothing was saved.', ...refusal }, { status: 400, headers: NO_STORE });
  }

  const officer = await ensureUser(auth.session);
  const results: { id: string; type: Operation['type']; status: string; code?: string; item?: number; character?: string | null }[] = [];
  try {
    for (let from = 0; from < parsed.operations.length; from += BATCH) {
      const operations = parsed.operations.slice(from, from + BATCH);
      const batch = await writeOperationBatch({ raidId, operations, env, officerId: officer.id, receivedAt: new Date(), via: 'import' });
      operations.forEach((op, i) => {
        const outcome = batch[i];
        const named = award(op);
        results.push({ id: op.id, type: op.type, status: outcome.status, ...('code' in outcome ? { code: outcome.code } : {}), ...(named ? { item: named.item, character: named.char } : {}) });
      });
    }
  } catch (error) {
    console.error('loot import failed', error);
    return NextResponse.json({ error: 'Couldn’t finish importing. Paste the same text again to finish.' }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ results }, { headers: NO_STORE });
}
