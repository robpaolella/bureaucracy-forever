/**
 * The catch-up (ADDON-SPEC 3.4, served by `GET /api/helper/raids/{raid}/catchup`): a raid's
 * awards and voids as the site holds them now. Awards share the snapshot's baseline builder, so
 * both agree on keys.
 */
import 'server-only';

import { FORMAT_VERSION, type SiteEnv } from '@/lib/addon-operations';
import { baselineAward, type SnapshotAward, type SnapshotInput } from '@/lib/addon-snapshot';
import { db } from '@/lib/db';
import { isStagingDeployment } from '@/lib/deploy-env';

export type CatchupAward = SnapshotAward & { state: 'announced' | 'confirmed' | 'not-confirmed' | 'manual'; at: number; practice?: true };
export type CatchupVoid = { key: string; reason?: string; at: number };
export type Catchup = { formatVersion: typeof FORMAT_VERSION; raid: string; env: SiteEnv; generated: number; awards: CatchupAward[]; voids: CatchupVoid[] };

export type CatchupInput = {
  raidId: string;
  env: SiteEnv;
  now: Date;
  /** Every award on the raid, voided ones included, oldest first. */
  awards: (SnapshotInput['awards'][number] & { source: 'LOOT_LOG' | 'ADDON'; confirmation: 'ANNOUNCED' | 'CONFIRMED' | 'NOT_CONFIRMED'; confirmedAt: Date | null; awardedAt: Date | null; createdAt: Date; practice: boolean })[];
  /** Operations kept waiting for an award the site doesn't hold: a void, or a replace (which voids its original). */
  pending: { key: string; at: Date; payload: unknown }[];
};

const seconds = (d: Date) => Math.floor(d.getTime() / 1000);
const STATES = { ANNOUNCED: 'announced', CONFIRMED: 'confirmed', NOT_CONFIRMED: 'not-confirmed' } as const;

export function buildCatchup(input: CatchupInput): Catchup {
  return {
    formatVersion: FORMAT_VERSION,
    raid: input.raidId,
    env: input.env,
    generated: seconds(input.now),
    awards: input.awards.map((a): CatchupAward => ({
      ...baselineAward(a),
      // A hand-recorded award was never confirmed by a game; its state last changed when it was made.
      state: a.source === 'LOOT_LOG' ? 'manual' : STATES[a.confirmation],
      at: seconds(a.source === 'LOOT_LOG' ? a.createdAt : (a.confirmedAt ?? a.awardedAt ?? a.createdAt)),
      ...(a.practice ? { practice: true as const } : {}),
    })),
    voids: input.pending.map((p): CatchupVoid => {
      const reason = (p.payload as { reason?: unknown } | null)?.reason;
      return { key: p.key, ...(typeof reason === 'string' && reason ? { reason } : {}), at: seconds(p.at) };
    }),
  };
}

/** A raid's catch-up from the database. The caller has checked that the raid exists. */
export async function loadCatchup(raidId: string, now: Date = new Date()): Promise<Catchup> {
  const [awards, pending] = await Promise.all([
    db.lootAward.findMany({
      where: { raidId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, requestKey: true, bossId: true, itemId: true, characterName: true, userId: true, method: true, roll: true, voidedAt: true, source: true, confirmation: true, confirmedAt: true, awardedAt: true, createdAt: true, practice: true },
    }),
    db.lootOperation.findMany({
      where: { raidId, status: 'PENDING', type: { in: ['VOID', 'REPLACE'] } },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      select: { key: true, at: true, payload: true },
    }),
  ]);
  return buildCatchup({ raidId, env: isStagingDeployment() ? 'staging' : 'production', now, awards, pending });
}
