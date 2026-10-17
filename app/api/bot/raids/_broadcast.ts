import { NextResponse } from 'next/server';
import { isSnowflake, NO_STORE, userByDiscordId } from '../_lib';

const deny = (status: number, body: Record<string, string>) => NextResponse.json(body, { status, headers: NO_STORE });

/** The /broadcast read gate (SYNC-SPEC §14): 400 for a missing or malformed `byDiscordId`, 403 unless it is an officer. Null when allowed. */
export async function broadcastDenied(request: Request): Promise<NextResponse | null> {
  const by = new URL(request.url).searchParams.get('byDiscordId');
  if (!isSnowflake(by)) return deny(400, { reason: 'invalid', error: 'byDiscordId must be a Discord id.' });
  const officer = await userByDiscordId(by);
  if (!officer || officer.role !== 'OFFICER') return deny(403, { reason: 'forbidden', error: 'Only officers can send broadcasts.' });
  return null;
}

export const raidSummary = (raid: { id: string; name: string; startsAt: Date; status: string }) =>
  ({ id: raid.id, name: raid.name, startsAt: raid.startsAt.toISOString(), status: raid.status });
