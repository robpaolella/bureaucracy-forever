/**
 * Loot reads shared by the raid detail page and the reserve route. Reserves count only while
 * their holder's sign-up is Accept or Tentative (lib/loot-rules.ts isEligible).
 */
import 'server-only';

import { db } from '@/lib/db';
import type { WowClass } from '@/lib/design/class-colors';
import { blockedItemIds, winLimits } from '@/lib/loot-blocks';
import { toItemView, type ItemView } from '@/lib/loot-items';
import type { LoggedAward, LoggedHr } from '@/lib/loot-log-state';
import { hrBlocked, isEligible, winLimitOf, type LootMethod, type ReserveKind, type WinLimits } from '@/lib/loot-rules';
import type { RaidResponse } from '@/lib/raids';

export type LootTableView = {
  bosses: { id: string; name: string; isTrash: boolean; itemIds: number[] }[];
  items: Record<number, ItemView>;
  /** Items officers closed to new reserves for the whole tier (lib/loot-blocks.ts). */
  blocked: number[];
  /** Items whose win limit is above 1, for drop resolution; any other item's limit is 1. */
  winLimits?: WinLimits;
};

/** A raid tier's table for pickers and the loot log, or null when it has no items yet. */
export async function loadLootTable(templateId: string): Promise<LootTableView | null> {
  const [bosses, blocked, limits] = await Promise.all([db.lootBoss.findMany({
    where: { templateId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, isTrash: true, entries: { orderBy: [{ position: 'asc' }, { itemId: 'asc' }], select: { item: true } } },
  }), blockedItemIds(templateId), winLimits(templateId)]);
  const items: Record<number, ItemView> = {};
  for (const b of bosses) for (const e of b.entries) items[e.item.id] = toItemView(e.item);
  if (Object.keys(items).length === 0) return null;
  return { bosses: bosses.map((b) => ({ id: b.id, name: b.name, isTrash: b.isTrash, itemIds: b.entries.map((e) => e.item.id) })), items, blocked: [...blocked].filter((id) => items[id]).sort((a, b) => a - b), winLimits: limits };
}

/** Every item id in a raid tier's table. */
export async function tableItemIds(templateId: string): Promise<Set<number>> {
  const rows = await db.lootTableEntry.findMany({ where: { boss: { templateId } }, select: { itemId: true } });
  return new Set(rows.map((r) => r.itemId));
}

export type ReserveView = {
  userId: string;
  /** Discord name first (the site's convention); the character is secondary. */
  name: string;
  characterId: string;
  characterName: string;
  wowClass: WowClass;
  itemId: number;
  kind: ReserveKind;
};

const lower = <T extends string>(v: T) => v.toLowerCase() as Lowercase<T>;

/** A raid's reserves whose holders are still eligible, in a stable order. */
export async function loadActiveReserves(raidId: string): Promise<ReserveView[]> {
  const rows = await db.reserve.findMany({
    where: { raidId, user: { signups: { some: { raidId, response: { in: ['ACCEPT', 'TENTATIVE'] } } } } },
    orderBy: [{ itemId: 'asc' }, { kind: 'asc' }, { userId: 'asc' }],
    select: { userId: true, characterId: true, itemId: true, kind: true, user: { select: { discordName: true } }, character: { select: { name: true, class: true } } },
  });
  return rows.map((r) => ({ userId: r.userId, name: r.user.discordName, characterId: r.characterId, characterName: r.character.name, wowClass: lower(r.character.class) as WowClass, itemId: r.itemId, kind: r.kind }));
}

/** Non-voided HR/SR wins across all raids, including the current raid. Keeps the legacy HR name. */
export async function hrAwardsFor(characterIds: readonly string[]): Promise<LoggedHr[]> {
  if (characterIds.length === 0) return [];
  // Open roll, disenchant/bank and legacy main/off spec awards do not block reserves.
  const rows = await db.lootAward.findMany({ where: { characterId: { in: [...characterIds] }, method: { in: ['HR', 'SR'] }, voidedAt: null }, select: { id: true, characterId: true, itemId: true } });
  return rows.flatMap((r) => (r.characterId ? [{ id: r.id, characterId: r.characterId, itemId: r.itemId }] : []));
}

/** The sign-up answer as lib/raids spells it, and whether it can reserve. */
export function signupAnswer(response: 'ACCEPT' | 'TENTATIVE' | 'ABSENT' | null | undefined): { response: RaidResponse | null; eligible: boolean } {
  const r = response ? (lower(response) as RaidResponse) : null;
  return { response: r, eligible: isEligible(r) };
}

export type ReserveTargetRow = {
  userId: string;
  name: string;
  self: boolean;
  characters: { id: string; name: string; wowClass: WowClass; isMain: boolean }[];
  current: { characterId: string | null; hr: number | null; sr: number | null };
  /** Items won as many times as their win limit, blocked for both HR and SR; legacy field name. */
  blockedHr: Record<string, number[]>;
};

/**
 * Whose reserves the viewer may set on this raid: themselves when their sign-up is eligible
 * and they have a character; an officer also everyone else who is eligible. `reason` says
 * why the viewer has nothing to set.
 */
export async function loadReserveTargets(raidId: string, viewerDiscordId: string, officer: boolean): Promise<{ targets: ReserveTargetRow[]; reason: 'notEligible' | 'noCharacter' | null }> {
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { templateId: true } });
  const signups = await db.signup.findMany({
    where: { raidId, ...(officer ? {} : { user: { discordId: viewerDiscordId } }) },
    select: {
      response: true,
      user: {
        select: {
          id: true,
          discordId: true,
          discordName: true,
          characters: { orderBy: [{ isMain: 'desc' }, { name: 'asc' }], select: { id: true, name: true, class: true, isMain: true } },
          reserves: { where: { raidId }, select: { characterId: true, itemId: true, kind: true } },
        },
      },
    },
  });
  const mine = signups.find((s) => s.user.discordId === viewerDiscordId);
  const usable = signups.filter((s) => signupAnswer(s.response).eligible && s.user.characters.length > 0);
  const [awards, limits] = await Promise.all([
    hrAwardsFor(usable.flatMap((s) => s.user.characters.map((c) => c.id))),
    raid?.templateId ? winLimits(raid.templateId) : Promise.resolve({}),
  ]);
  const targets = usable
    .map((s): ReserveTargetRow => {
      const blockedHr: Record<string, number[]> = {};
      for (const c of s.user.characters) {
        const won = [...new Set(awards.filter((a) => a.characterId === c.id).map((a) => a.itemId))];
        const atLimit = won.filter((itemId) => hrBlocked(c.id, itemId, awards, [], winLimitOf(itemId, limits)));
        if (atLimit.length) blockedHr[c.id] = atLimit;
      }
      return {
        userId: s.user.id,
        name: s.user.discordName,
        self: s.user.discordId === viewerDiscordId,
        characters: s.user.characters.map((c) => ({ id: c.id, name: c.name, wowClass: lower(c.class) as WowClass, isMain: c.isMain })),
        current: {
          characterId: s.user.reserves[0]?.characterId ?? null,
          hr: s.user.reserves.find((r) => r.kind === 'HR')?.itemId ?? null,
          sr: s.user.reserves.find((r) => r.kind === 'SR')?.itemId ?? null,
        },
        blockedHr,
      };
    })
    .sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name));
  const reason = targets.some((t) => t.self) ? null : !mine || !signupAnswer(mine.response).eligible ? 'notEligible' : 'noCharacter';
  return { targets, reason };
}

/** GET /api/raids/[id]/reserves: what the reserves window needs away from the raid page. */
export type ReserveWindowData = { table: LootTableView; reserves: ReserveView[]; targets: ReserveTargetRow[]; lockAt: string; locked: boolean; cancelled: boolean };

export type AwardView = {
  id: string;
  itemId: number;
  bossName: string | null;
  /** Null for disenchant/bank. */
  winner: { name: string | null; characterName: string; wowClass: WowClass | null } | null;
  method: LootMethod;
  roll: number | null;
  note: string | null;
  createdAt: string;
  recordedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
};

/** A raid's loot records, newest first, voided ones included (the caller decides who sees them). */
export async function loadAwards(raidId: string): Promise<AwardView[]> {
  const rows = await db.lootAward.findMany({
    where: { raidId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, itemId: true, bossName: true, characterName: true, method: true, roll: true, note: true, createdAt: true, recordedById: true, voidedAt: true, voidReason: true,
      user: { select: { discordName: true } },
      character: { select: { class: true } },
    },
  });
  const officers = new Map((await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.recordedById))] } }, select: { id: true, discordName: true } })).map((u) => [u.id, u.discordName]));
  return rows.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    bossName: r.bossName,
    winner: r.characterName ? { name: r.user?.discordName ?? null, characterName: r.characterName, wowClass: r.character ? (lower(r.character.class) as WowClass) : null } : null,
    method: r.method,
    roll: r.roll,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    recordedBy: officers.get(r.recordedById) ?? null,
    voidedAt: r.voidedAt?.toISOString() ?? null,
    voidReason: r.voidReason,
  }));
}

export type { LoggedAward, LoggedHr };

export type Candidate = { userId: string; name: string; characters: { id: string; name: string; wowClass: WowClass; isMain: boolean }[] };

/**
 * For the loot log: everyone eligible on the raid with their characters, the non-voided
 * awards on it (who already got what), and HR/SR wins for resolveDrop.
 */
export async function loadLootLogContext(raidId: string): Promise<{ candidates: Candidate[]; raidAwards: LoggedAward[]; hrAwards: LoggedHr[] }> {
  const [signups, awards] = await Promise.all([
    db.signup.findMany({
      where: { raidId, response: { in: ['ACCEPT', 'TENTATIVE'] } },
      select: { user: { select: { id: true, discordName: true, characters: { orderBy: [{ isMain: 'desc' }, { name: 'asc' }], select: { id: true, name: true, class: true, isMain: true } } } } },
    }),
    db.lootAward.findMany({ where: { raidId, voidedAt: null }, select: { id: true, itemId: true, userId: true } }),
  ]);
  const candidates = signups
    .filter((s) => s.user.characters.length > 0)
    .map((s) => ({ userId: s.user.id, name: s.user.discordName, characters: s.user.characters.map((c) => ({ id: c.id, name: c.name, wowClass: lower(c.class) as WowClass, isMain: c.isMain })) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const hrAwards = await hrAwardsFor(candidates.flatMap((c) => c.characters.map((ch) => ch.id)));
  return { candidates, raidAwards: awards, hrAwards };
}
