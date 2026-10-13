import 'server-only';

import { db } from '@/lib/db';
import type { LootOperationType, Prisma } from '@/lib/generated/prisma/client';
import { lockReserveTier } from '@/lib/loot-blocks';
import { applyOperation, keyOf, samePayload, type AwardOperation, type Change, type LootState, type Operation, type Outcome, type RejectCode, type SiteEnv } from '@/lib/addon-operations';

/**
 * Stores a batch of the add-on's operations for one raid in one transaction (ADDON-SPEC
 * section 5), answering per operation in the batch's order. The caller has already parsed the
 * operations and checked that the officer is a current one; this trusts the id it is given.
 *
 * Safe with several helpers at once: a batch takes the tier lock (as the loot log does, so an
 * award and a table edit never interleave), then the raid's row, so two batches for one raid
 * run one after the other and the second sees the first's records. Keys are unique across
 * raids, so it then locks each id and key it names, in order: a batch for another raid naming
 * one waits, including for a held replacement's new key, which no unique index guards. A key
 * typed into the loot log meanwhile fails the unique index; the batch then runs again.
 */
export async function writeOperationBatch(input: BatchInput): Promise<BatchResult[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction((tx) => writeBatch(tx, input), { isolationLevel: 'ReadCommitted', timeout: 30_000 });
    } catch (error) {
      const retry = error instanceof RaidChanged || ['P2002', 'P2034'].includes((error as { code?: string }).code ?? '');
      if (!retry || attempt === ATTEMPTS) throw error;
    }
  }
}

export type BatchInput = { raidId: string; operations: Operation[]; env: SiteEnv; officerId: string; receivedAt: Date };
export type BatchResult = { id: string } & Outcome;

const ATTEMPTS = 3;
const TYPES: Record<Operation['type'], LootOperationType> = { award: 'AWARD', confirm: 'CONFIRM', 'not-confirmed': 'NOT_CONFIRMED', void: 'VOID', replace: 'REPLACE' };
const gameTime = (at: number) => new Date(at * 1000);
const json = (op: Operation) => op as unknown as Prisma.InputJsonValue;

/** The raid's loot table moved to another tier between reading it and locking that tier. */
class RaidChanged extends Error {}

type Tx = Prisma.TransactionClient;
type Names = { bosses: Map<string, string>; characters: Map<string, { id: string; name: string; userId: string }>; users: Set<string> };

async function writeBatch(tx: Tx, { raidId, operations, env, officerId, receivedAt }: BatchInput): Promise<BatchResult[]> {
  const raid = await lockRaid(tx, raidId);
  const results: BatchResult[] = [];
  if (!raid) {
    for (const op of operations) {
      const code = op.env !== env ? 'wrong-environment' : 'unknown-raid';
      await keepRejection(tx, op, code, officerId, receivedAt);
      results.push({ id: op.id, status: 'rejected', code });
    }
    return results;
  }

  // Sorted, so two batches never wait on each other's keys in a circle.
  for (const key of [...new Set(operations.flatMap((o) => [o.id, keyOf(o), ...(o.type === 'replace' ? [o.award.id] : [])]))].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`addon-key:${key}`}, 0))`;
  }
  const state = await loadState(tx, raidId, operations);
  const items = new Set(raid.templateId ? (await tx.lootTableEntry.findMany({ where: { boss: { templateId: raid.templateId } }, select: { itemId: true } })).map((e) => e.itemId) : []);
  const names = await loadNames(tx, raid.templateId, operations, state);
  // Resolved the way the loot log does; the winner is not checked against sign-ups or reserves.
  const check = (award: AwardOperation): RejectCode | null => {
    if (raid.cancelledAt) return 'raid-cancelled';
    if (!items.has(award.item)) return 'item-not-in-table';
    if (!names.bosses.has(award.boss)) return 'unknown-boss';
    if (award.char === null) return null;
    const character = names.characters.get(award.char);
    if (!character) return 'unknown-character';
    return award.user !== null && award.user !== character.userId ? 'user-mismatch' : null;
  };

  for (const op of operations) {
    const { outcome, changes } = applyOperation(state, op, { env, check }, { officerId, now: receivedAt });
    if (outcome.status === 'rejected') await keepRejection(tx, op, outcome.code, officerId, receivedAt);
    for (const change of changes) await save(tx, raidId, change, names, receivedAt);
    results.push({ id: op.id, ...outcome });
  }
  return results;
}

async function lockRaid(tx: Tx, raidId: string) {
  const raid = await tx.raid.findUnique({ where: { id: raidId }, select: { templateId: true } });
  if (!raid) return null;
  if (raid.templateId) await lockReserveTier(tx, raid.templateId);
  // FOR NO KEY UPDATE also makes a cancellation wait, so the check below stays true until commit.
  const [locked] = await tx.$queryRaw<{ templateId: string | null; cancelledAt: Date | null }[]>`SELECT "templateId", "cancelledAt" FROM "Raid" WHERE "id" = ${raidId} FOR NO KEY UPDATE`;
  if (!locked || locked.templateId !== raid.templateId) throw new RaidChanged();
  return locked;
}

/**
 * The raid's keyed awards and receipts, plus any held on other raids under the batch's ids and
 * keys, including a replacement elsewhere that carries one of its ids as its new award.
 */
async function loadState(tx: Tx, raidId: string, operations: Operation[]): Promise<LootState> {
  const ids = operations.flatMap((op) => (op.type === 'replace' ? [op.id, op.award.id] : [op.id]));
  const keys = [...new Set([...ids, ...operations.map(keyOf)])];
  const carrying = await tx.$queryRaw<{ opId: string }[]>`SELECT "opId" FROM "LootOperation" WHERE "type" = 'REPLACE' AND "payload"->'award'->>'id' = ANY(${ids})`;
  const awards = await tx.lootAward.findMany({
    where: { OR: [{ raidId, requestKey: { not: null } }, { requestKey: { in: keys } }] },
    select: { requestKey: true, raidId: true, voidedAt: true, confirmation: true, confirmedAt: true },
  });
  const receipts = await tx.lootOperation.findMany({
    where: { OR: [{ raidId }, { opId: { in: [...ids, ...carrying.map((r) => r.opId)] } }] },
    select: { opId: true, payload: true, status: true, deliveredById: true, receivedAt: true },
  });
  return {
    raidId,
    awards: new Map(awards.map((a) => [a.requestKey!, {
      raidId: a.raidId, voided: a.voidedAt !== null, confirmation: a.confirmation,
      confirmedAt: a.confirmedAt && Math.floor(a.confirmedAt.getTime() / 1000),
    }])),
    receipts: new Map(receipts.map((r) => [r.opId, { op: r.payload as unknown as Operation, status: r.status, deliveredById: r.deliveredById, receivedAt: r.receivedAt }])),
  };
}

/** The tier's bosses, and every character and user an award in the batch or a held replacement names. */
async function loadNames(tx: Tx, templateId: string | null, operations: Operation[], state: LootState): Promise<Names> {
  const awards = [...operations, ...[...state.receipts.values()].map((r) => r.op)]
    .flatMap((op) => (op.type === 'award' ? [op] : op.type === 'replace' ? [op.award] : []));
  const wanted = [...new Set(awards.flatMap((a) => (a.char ? [a.char, a.sender] : [a.sender])))];
  const bosses = templateId ? await tx.lootBoss.findMany({ where: { templateId }, select: { id: true, name: true } }) : [];
  const characters = await tx.character.findMany({ where: { name: { in: wanted } }, select: { id: true, name: true, userId: true } });
  const users = await tx.user.findMany({ where: { id: { in: awards.flatMap((a) => (a.user ? [a.user] : [])) } }, select: { id: true } });
  return { bosses: new Map(bosses.map((b) => [b.id, b.name])), characters: new Map(characters.map((c) => [c.name, c])), users: new Set(users.map((u) => u.id)) };
}

async function save(tx: Tx, raidId: string, change: Change, names: Names, now: Date) {
  switch (change.kind) {
    case 'receipt': {
      const { op, status, deliveredById, receivedAt } = change.receipt;
      await tx.lootOperation.create({ data: { opId: op.id, raidId, type: TYPES[op.type], key: keyOf(op), payload: json(op), at: gameTime(op.at), status, deliveredById, receivedAt, appliedAt: status === 'APPLIED' ? now : null } });
      return;
    }
    case 'applied':
      await tx.lootOperation.update({ where: { opId: change.opId }, data: { status: 'APPLIED', appliedAt: now } });
      return;
    case 'award': {
      const { award } = change;
      // A replacement held since an earlier batch was checked then. If its name has gone, or now
      // belongs to another account, the name is kept as sent and the winner stays the user checked.
      const found = award.char ? names.characters.get(award.char) : undefined;
      const character = found && (award.user === null || found.userId === award.user) ? found : undefined;
      await tx.lootAward.create({ data: {
        raidId,
        bossId: names.bosses.has(award.boss) ? award.boss : null,
        bossName: names.bosses.get(award.boss) ?? null,
        itemId: award.item,
        characterId: character?.id ?? null,
        characterName: character?.name ?? award.char,
        userId: character?.userId ?? (award.user && names.users.has(award.user) ? award.user : null),
        method: award.method,
        roll: award.roll,
        note: award.note,
        recordedById: change.recordedById,
        requestKey: award.id,
        source: 'ADDON',
        awardedAt: gameTime(award.at),
        handedOutByName: award.sender,
        handedOutById: names.characters.get(award.sender)?.userId ?? null,
        confirmation: 'ANNOUNCED',
        practice: award.practice,
      } });
      return;
    }
    case 'void':
      // voidedAt: null, so a void typed into the loot log meanwhile keeps its reason and time.
      await tx.lootAward.updateMany({ where: { requestKey: change.key, voidedAt: null }, data: { voidedAt: change.voidedAt, voidedById: change.voidedById, voidReason: change.reason } });
      return;
    case 'confirmation':
      await tx.lootAward.update({ where: { requestKey: change.key }, data: { confirmation: change.confirmation, confirmedAt: gameTime(change.confirmedAt) } });
  }
}

/** Kept for the raid's problems list (section 7.4); the same record refused again is listed once. */
async function keepRejection(tx: Tx, op: Operation, code: RejectCode, deliveredById: string, receivedAt: Date) {
  const earlier = await tx.lootOperationRejection.findMany({ where: { opId: op.id, code }, select: { payload: true } });
  if (earlier.some((r) => samePayload(r.payload as unknown as Operation, op))) return;
  await tx.lootOperationRejection.create({ data: { raidId: op.raid, opId: op.id, code, payload: json(op), deliveredById, receivedAt } });
}
