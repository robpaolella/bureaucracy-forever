'use server';

import type { ApplyGate } from '@/components/recruitment/form-state';
import { applyGate } from '@/lib/apply-gate';

/** The apply modal asks this when it opens, so it shows what /apply would (SYNC-SPEC §9.1). */
export async function checkApplyGate(): Promise<ApplyGate> {
  return applyGate();
}
