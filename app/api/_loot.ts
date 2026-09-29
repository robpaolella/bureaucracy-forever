import { NextResponse } from 'next/server';
import { lootEnabled } from '@/lib/flags';
import type { Session } from '@/lib/session';
import { NO_STORE, requireOfficer } from './_officer';

/** An officer's session for a loot route, or the 404 (flag off) / 401 / 403 to send back. */
export async function requireLootOfficer(): Promise<{ session: Session } | { deny: NextResponse }> {
  if (!lootEnabled()) return { deny: NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE }) };
  return requireOfficer();
}

export const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === 'P2002';
export const isMissing = (e: unknown) => (e as { code?: string }).code === 'P2025';
