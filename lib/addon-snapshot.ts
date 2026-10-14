/**
 * The reserve snapshot (ADDON-SPEC.md section 3.1): one data tree holding what the loot add-on
 * needs to run a raid's loot without the site. The Copy reserves bar and the helper's API both
 * build it here; lib/addon-snapshot-text.ts writes it as pasted text. Optional fields are left
 * out, never null, because the text grammar has no nil.
 */
import 'server-only';

import { addonForSnapshot, ADDON_RELEASES_URL, getAddonRelease } from '@/lib/addon-release';
import { FORMAT_VERSION, type SiteEnv } from '@/lib/addon-operations';
import { db } from '@/lib/db';
import { isStagingDeployment } from '@/lib/deploy-env';
import { loadActiveReserves, loadLootTable } from '@/lib/loot-data';
import { hrBlocked, winLimitOf, type HrAward, type LootMethod, type ReserveKind, type WinLimits } from '@/lib/loot-rules';

export type SnapshotHolder = { user: string; char: string; kind: ReserveKind; trial: boolean; blocked?: 'win-limit' };
export type SnapshotBoss = { id: string; name: string; trash: boolean; items: number[] };
export type SnapshotAward = { key: string; boss?: string; item: number; char?: string; user?: string; method: LootMethod; roll?: number; voided: boolean };
export type Snapshot = {
  formatVersion: typeof FORMAT_VERSION;
  raid: string;
  code: string;
  env: SiteEnv;
  name: string;
  startsAt: number;
  durationMin: number;
  /** The raid template's in-game instance id; absent when it has none (section 3.1). */
  instance?: number;
  generated: number;
  addon: { version: string; url: string };
  bosses: SnapshotBoss[];
  /** Item ids as string keys; the text writes them as integer keys. */
  reserves: Record<string, SnapshotHolder[]>;
  awards: SnapshotAward[];
};

/** The `addon` field when no release has been seen (#280 fills it from the lookup otherwise). */
export const ADDON_PLACEHOLDER = { version: '', url: `${ADDON_RELEASES_URL}/latest` };

export type SnapshotInput = {
  raid: { id: string; name: string; startsAt: Date; durationMin: number; /** From the template; null or absent when not set. */ instance?: number | null };
  env: SiteEnv;
  now: Date;
  /** The latest add-on version and where to get it; the placeholder when omitted. */
  addon?: { version: string; url: string };
  bosses: SnapshotBoss[];
  reserves: { userId: string; characterId: string; characterName: string; itemId: number; kind: ReserveKind; onTrial: boolean }[];
  winLimits: WinLimits;
  /** Non-voided HR/SR wins from other raids; this raid's own are the add-on's to subtract. */
  earlierWins: HrAward[];
  /** Every award on this raid, voided ones included, oldest first. */
  awards: { id: string; requestKey: string | null; bossId: string | null; itemId: number; characterName: string | null; userId: string | null; method: LootMethod; roll: number | null; voidedAt: Date | null }[];
};

const seconds = (d: Date) => Math.floor(d.getTime() / 1000);

/** `P` or `S`, then the last five characters of the raid id, upper-case (section 2). */
export const raidCode = (env: SiteEnv, raidId: string) => (env === 'staging' ? 'S' : 'P') + raidId.slice(-5).toUpperCase();

export function buildSnapshot(input: SnapshotInput): Snapshot {
  const { raid, env, now } = input;
  const reserves: Record<string, SnapshotHolder[]> = {};
  for (const r of input.reserves) {
    const holder: SnapshotHolder = { user: r.userId, char: r.characterName, kind: r.kind, trial: r.onTrial };
    if (hrBlocked(r.characterId, r.itemId, input.earlierWins, [], winLimitOf(r.itemId, input.winLimits))) holder.blocked = 'win-limit';
    (reserves[String(r.itemId)] ??= []).push(holder);
  }
  const awards = input.awards.map((a): SnapshotAward => ({
    // An award recorded by hand has no key; the site makes the same one every time.
    key: a.requestKey ?? `site-${a.id}`,
    ...(a.bossId ? { boss: a.bossId } : {}),
    item: a.itemId,
    ...(a.characterName ? { char: a.characterName } : {}),
    ...(a.userId ? { user: a.userId } : {}),
    method: a.method,
    ...(a.roll !== null ? { roll: a.roll } : {}),
    voided: a.voidedAt !== null,
  }));
  return {
    formatVersion: FORMAT_VERSION,
    raid: raid.id,
    code: raidCode(env, raid.id),
    env,
    name: raid.name,
    startsAt: seconds(raid.startsAt),
    durationMin: raid.durationMin,
    ...(raid.instance ? { instance: raid.instance } : {}),
    generated: seconds(now),
    addon: { ...(input.addon ?? ADDON_PLACEHOLDER) },
    bosses: input.bosses,
    reserves,
    awards,
  };
}

/** A raid's snapshot from the database, or null when the raid doesn't exist. */
export async function loadSnapshot(raidId: string, now: Date = new Date()): Promise<Snapshot | null> {
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { id: true, name: true, startsAt: true, durationMin: true, templateId: true, template: { select: { instance: true } } } });
  if (!raid) return null;
  const [table, reserves, awards, addon] = await Promise.all([
    raid.templateId ? loadLootTable(raid.templateId) : null,
    loadActiveReserves(raid.id),
    db.lootAward.findMany({
      where: { raidId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, requestKey: true, bossId: true, itemId: true, characterName: true, userId: true, method: true, roll: true, voidedAt: true },
    }),
    getAddonRelease().then(addonForSnapshot),
  ]);
  const wins = await db.lootAward.findMany({
    where: { raidId: { not: raidId }, characterId: { in: [...new Set(reserves.map((r) => r.characterId))] }, method: { in: ['HR', 'SR'] }, voidedAt: null },
    select: { characterId: true, itemId: true },
  });
  return buildSnapshot({
    raid: { ...raid, instance: raid.template?.instance },
    env: isStagingDeployment() ? 'staging' : 'production',
    now,
    addon,
    bosses: (table?.bosses ?? []).map((b) => ({ id: b.id, name: b.name, trash: b.isTrash, items: b.itemIds })),
    reserves,
    winLimits: table?.winLimits ?? {},
    earlierWins: wins.flatMap((w) => (w.characterId ? [{ characterId: w.characterId, itemId: w.itemId }] : [])),
    awards,
  });
}
