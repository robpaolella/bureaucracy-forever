/**
 * Hard and soft reserves, and who rolls when an item drops. Pure, so every branch is
 * unit-tested; the routes load rows and apply these.
 *
 * Each eligible member makes one hard reserve (HR) and one soft reserve (SR) per raid, on
 * different items, for one of their own characters. When an item drops, HR holders roll
 * first, then SR holders, then everyone. A character who has won an item through HR or SR
 * cannot reserve it again; `exceptions` is where officer-granted exceptions will come in.
 */
import type { RaidResponse } from '@/lib/raids';

export type ReserveKind = 'HR' | 'SR';
export type LootMethod = 'HR' | 'SR' | 'MAIN_SPEC' | 'OFF_SPEC' | 'OPEN_ROLL' | 'DISENCHANT_BANK';
export const LOOT_METHODS: readonly LootMethod[] = ['HR', 'SR', 'MAIN_SPEC', 'OFF_SPEC', 'OPEN_ROLL', 'DISENCHANT_BANK'];
/** Methods officers can select for new loot-log records. Legacy records still use LOOT_METHODS. */
export const LOOT_LOG_METHODS: readonly LootMethod[] = ['HR', 'SR', 'OPEN_ROLL', 'DISENCHANT_BANK'];
export type ItemSource = 'CLASSIC' | 'FOREVER';

export type Refusal = { ok: false; status: 403 | 404 | 409; reason: string };

/** Reserves lock this long before the raid starts, whatever the sign-up lock is. */
export const RESERVE_LOCK_MINUTES = 120;

export const REASONS = {
  social: 'Reserves are for guild members.',
  cancelled: 'This raid was cancelled.',
  noTable: 'This raid has no loot table yet.',
  notEligible: 'Sign up as Accept or Tentative to reserve.',
  locked: 'Reserves are locked. Ask an officer to change them.',
  notYourCharacter: 'That character is not yours.',
  notInTable: "That item isn't in this raid's loot table.",
  sameItem: 'Your hard and soft reserve must be different items.',
  itemBlocked: 'Not open to reserves',
  hrReceived: 'This character already won that item.',
  alreadyVoided: 'That record is already void.',
};

export function reservesLockAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - RESERVE_LOCK_MINUTES * 60_000);
}

export function reservesLocked(startsAt: Date, now: Date): boolean {
  return now.getTime() >= reservesLockAt(startsAt).getTime();
}

/** Accept or Tentative. Unanswered and Absent sign-ups neither reserve nor roll. */
export function isEligible(response: RaidResponse | null | undefined): boolean {
  return response === 'accept' || response === 'tentative';
}

/** A non-voided HR or SR award. Legacy HR names also cover SR wins. */
export type HrAward = { characterId: string; itemId: number };
/** An officer's permission for a character to reserve an item again. None exist yet. */
export type HrException = { characterId: string; itemId: number };

export function hrBlocked(characterId: string, itemId: number, hrAwards: readonly HrAward[], exceptions: readonly HrException[] = [], allowedCount = 1): boolean {
  const match = (r: { characterId: string; itemId: number }) => r.characterId === characterId && r.itemId === itemId;
  return hrAwards.filter(match).length >= allowedCount && !exceptions.some(match);
}

/** Why the picker can't choose an item for the slot being chosen. */
export type PickUnavailable = 'won' | 'otherSlot' | 'blocked';

/**
 * One reason per item: previously won is the strongest fact about this member, then the
 * other slot's pick, then an officer's block. A saved pick in this slot still shows its
 * reason but keeps Remove; the picker checks `picked` first.
 */
export function pickUnavailable(itemId: number, ctx: { won: ReadonlySet<number>; otherSlotPick: number | null; blocked: ReadonlySet<number> }): PickUnavailable | null {
  if (ctx.won.has(itemId)) return 'won';
  if (ctx.otherSlotPick === itemId) return 'otherSlot';
  if (ctx.blocked.has(itemId)) return 'blocked';
  return null;
}

/**
 * Whether a draft pick stays when the member switches to `characterId`: not if that
 * character already won it, and a blocked item only as the pick it was saved as, for the
 * character it was saved with (what decideReserve keeps).
 */
export function pickSurvivesCharacter(kind: ReserveKind, itemId: number, characterId: string, ctx: { won: readonly number[]; blocked: readonly number[]; saved: { characterId: string | null; hr: number | null; sr: number | null } }): boolean {
  if (ctx.won.includes(itemId)) return false;
  if (!ctx.blocked.includes(itemId)) return true;
  return ctx.saved.characterId === characterId && ctx.saved[kind === 'HR' ? 'hr' : 'sr'] === itemId;
}

export type ReserveRaid = { cancelled: boolean; startsAt: Date; hasLootTable: boolean };
export type ReserveInput = { characterId: string; hr: number | null; sr: number | null };
export type ReserveContext = {
  /** The sign-up answer of the member the reserves are for. */
  response: RaidResponse | null;
  ownCharacterIds: readonly string[];
  tableItemIds: ReadonlySet<number>;
  hrAwards: readonly HrAward[];
  exceptions?: readonly HrException[];
  blockedItemIds?: ReadonlySet<number>;
  /** Current rows for this member and raid, read under the tier lock. */
  existingReserves?: readonly { characterId: string; itemId: number; kind: ReserveKind }[];
};

/**
 * Setting (or clearing, with nulls) a member's reserves for a raid. `officerOverride` is an
 * officer acting on the web, which the lock does not stop.
 */
export function decideReserve(actor: { role: 'social' | 'member' | 'officer' }, raid: ReserveRaid, input: ReserveInput, ctx: ReserveContext, now: Date, officerOverride = false): { ok: true } | Refusal {
  if (actor.role === 'social') return { ok: false, status: 403, reason: REASONS.social };
  if (raid.cancelled) return { ok: false, status: 409, reason: REASONS.cancelled };
  if (!raid.hasLootTable) return { ok: false, status: 409, reason: REASONS.noTable };
  if (reservesLocked(raid.startsAt, now) && !(officerOverride && actor.role === 'officer')) return { ok: false, status: 409, reason: REASONS.locked };
  // Clearing is always allowed before the lock, so a member who turned Absent can take theirs back.
  if (input.hr === null && input.sr === null) return { ok: true };
  if (!isEligible(ctx.response)) return { ok: false, status: 409, reason: REASONS.notEligible };
  if (!ctx.ownCharacterIds.includes(input.characterId)) return { ok: false, status: 403, reason: REASONS.notYourCharacter };
  if (input.hr !== null && input.hr === input.sr) return { ok: false, status: 409, reason: REASONS.sameItem };
  for (const [kind, id] of [['HR', input.hr], ['SR', input.sr]] as const) {
    if (id === null) continue;
    if (ctx.blockedItemIds?.has(id)) {
      const kept = ctx.existingReserves?.some((r) => r.kind === kind && r.itemId === id && r.characterId === input.characterId);
      if (!kept) return { ok: false, status: 409, reason: REASONS.itemBlocked };
      // A kept blocked reserve survives later table changes and awards too.
      continue;
    }
    if (!ctx.tableItemIds.has(id)) return { ok: false, status: 409, reason: REASONS.notInTable };
    if (hrBlocked(input.characterId, id, ctx.hrAwards, ctx.exceptions)) return { ok: false, status: 409, reason: REASONS.hrReceived };
  }
  return { ok: true };
}

/** A reserve whose holder is eligible for this raid (the caller filters on the sign-up). */
export type ActiveReserve = { userId: string; characterId: string; itemId: number; kind: ReserveKind };
/** A non-voided award on this raid. */
export type RaidAward = { itemId: number; userId: string | null };

export type DropMode = 'HR' | 'SR' | 'OPEN';
export type Resolution = { mode: DropMode; contenders: ActiveReserve[] };

/**
 * Who rolls for a drop. A reserve is spent once its holder has received that item on this
 * raid, so a second copy goes to the remaining HR holders, then SR holders, then an open roll.
 * HR and SR holders whose characters already won through either reserve method are skipped too.
 */
export function resolveDrop(itemId: number, reserves: readonly ActiveReserve[], raidAwards: readonly RaidAward[], hrAwards: readonly HrAward[], exceptions: readonly HrException[] = []): Resolution {
  const received = new Set(raidAwards.filter((a) => a.itemId === itemId && a.userId).map((a) => a.userId));
  const live = reserves.filter((r) => r.itemId === itemId && !received.has(r.userId) && !hrBlocked(r.characterId, itemId, hrAwards, exceptions));
  const hr = live.filter((r) => r.kind === 'HR');
  if (hr.length > 0) return { mode: 'HR', contenders: hr };
  const sr = live.filter((r) => r.kind === 'SR');
  if (sr.length > 0) return { mode: 'SR', contenders: sr };
  return { mode: 'OPEN', contenders: [] };
}

/** The method the loot log preselects for a resolution. */
export function defaultMethodFor(mode: DropMode): LootMethod {
  return mode === 'OPEN' ? 'OPEN_ROLL' : mode;
}

/** Who reserved each item, by kind and in input order; the counts are the list lengths. */
export function reserveHolders<T extends ActiveReserve>(reserves: readonly T[]): Map<number, Record<ReserveKind, T[]>> {
  const out = new Map<number, Record<ReserveKind, T[]>>();
  for (const r of reserves) {
    const holders = out.get(r.itemId) ?? { HR: [], SR: [] };
    holders[r.kind].push(r);
    out.set(r.itemId, holders);
  }
  return out;
}

const MAX_ITEM_ID = 10_000_000;

/**
 * An item id typed by an officer: "17076", "item=17076", or a Wowhead link such as
 * https://www.wowhead.com/classic/item=17076/bonereavers-edge. The source is set only when
 * the link names the classic or forever database.
 */
export function parseItemRef(text: string): { id: number; source?: ItemSource } | null {
  const t = text.trim();
  const m = /^(\d+)$/.exec(t) ?? /(?:^|[?&/])item=(\d+)(?![\d\w])/.exec(t);
  if (!m) return null;
  const id = Number(m[1]);
  if (!Number.isSafeInteger(id) || id < 1 || id >= MAX_ITEM_ID) return null;
  const db = /wowhead\.com\/(classic|forever)\//i.exec(t)?.[1]?.toLowerCase();
  return db ? { id, source: db === 'forever' ? 'FOREVER' : 'CLASSIC' } : { id };
}

export type AwardInput = { bossId: string | null; itemId: number; characterId: string | null; method: LootMethod; roll: number | null; note: string };
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** The loot log's record form. Rolls are /roll 1–100; disenchant/bank has no character. */
export function parseAwardInput(body: unknown): Parsed<AwardInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN);
  const itemId = num(b.itemId);
  if (!Number.isSafeInteger(itemId) || itemId < 1) return { ok: false, error: 'Pick an item.' };
  const method = typeof b.method === 'string' && (LOOT_METHODS as readonly string[]).includes(b.method) ? (b.method as LootMethod) : null;
  if (!method) return { ok: false, error: 'Pick how it was handed out.' };
  const characterId = typeof b.characterId === 'string' && b.characterId ? b.characterId : null;
  if (method !== 'DISENCHANT_BANK' && !characterId) return { ok: false, error: 'Pick who won it.' };
  let roll: number | null = null;
  if (b.roll !== undefined && b.roll !== null && b.roll !== '') {
    roll = num(b.roll);
    if (!Number.isInteger(roll) || roll < 1 || roll > 100) return { ok: false, error: 'A roll is 1 to 100.' };
  }
  const bossId = typeof b.bossId === 'string' && b.bossId ? b.bossId : null;
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 500) : '';
  return { ok: true, value: { bossId, itemId, characterId: method === 'DISENCHANT_BANK' ? null : characterId, method, roll, note } };
}

/** Voiding is the only correction; a void record stays void. */
export function decideVoid(award: { voidedAt: Date | null }): { ok: true } | Refusal {
  return award.voidedAt ? { ok: false, status: 409, reason: REASONS.alreadyVoided } : { ok: true };
}
