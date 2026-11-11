import { NextResponse } from 'next/server';
import { guardHelperRequest, HELPER_NO_STORE, helperError, siteEnv } from '@/lib/helper-api';
import { parseUpload, recordUpload } from '@/lib/helper-operations';

/**
 * POST /api/helper/operations — the add-on's saved records, body `{ operations: [...] }` (ADDON-SPEC
 * 7.1). Answers 200 `{ results: [{ id, status, code? }] }` in the same order, recorded as the key's
 * officer. A body of the wrong shape is 400 `bad-request`; over 100 records, 413 `too-large`.
 */
export async function POST(request: Request) {
  const caller = await guardHelperRequest(request, { body: true });
  if ('deny' in caller) return caller.deny;
  const upload = parseUpload(caller.body);
  if (!upload.ok) return helperError(upload.status, upload.code, upload.error);
  try {
    const results = await recordUpload(upload.entries, { env: siteEnv(), officerId: caller.userId, receivedAt: new Date() });
    return NextResponse.json({ results }, { headers: HELPER_NO_STORE });
  } catch (error) {
    console.error('helper upload failed', error);
    return helperError(500, 'server-error', 'Couldn’t save the records. The helper will send them again.');
  }
}
