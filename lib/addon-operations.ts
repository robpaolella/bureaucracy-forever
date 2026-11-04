/**
 * The loot add-on's operations (ADDON-SPEC.md section 4) and the arrival rules that make
 * them safe late, twice and in any order (section 4.2). Pure: the batch writer loads a
 * raid's keyed awards and receipts into a LootState, passes each operation through
 * applyOperation, and saves the changes it returns in the same order.
 */
import { LOOT_METHODS, parseRequestKey, type LootMethod } from '@/lib/loot-rules';

export const FORMAT_VERSION = 1;
export type SiteEnv = 'production' | 'staging';

type Common = { id: string; formatVersion: typeof FORMAT_VERSION; raid: string; env: SiteEnv; practice: boolean; at: number };
export type AwardOperation = Common & { type: 'award'; boss: string; item: number; char: string | null; user: string | null; method: LootMethod; roll: number | null; note: string | null; sender: string };
export type ConfirmOperation = Common & { type: 'confirm' | 'not-confirmed'; key: string };
export type VoidOperation = Common & { type: 'void'; key: string; reason: string | null };
export type ReplaceOperation = Common & { type: 'replace'; key: string; award: AwardOperation };
export type Operation = AwardOperation | ConfirmOperation | VoidOperation | ReplaceOperation;

/** Notes, reasons and names: at most 200 characters (section 7.6). */
const TEXT_MAX = 200;
const MAX_ITEM_ID = 10_000_000;
/** The latest Unix second a JavaScript Date (and so a stored DateTime) can hold. */
const MAX_AT = 8_640_000_000_000;

type Parsed = { ok: true; value: Operation } | { ok: false; error: string; code?: 'unsupported-version' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' && v.trim() && v.length <= TEXT_MAX ? v.trim() : null);
const absent = (v: unknown) => v === undefined || v === null;
/** An optional note or reason: null when absent or blank, undefined when invalid. */
const optionalText = (v: unknown) => (absent(v) || (typeof v === 'string' && !v.trim()) ? null : (text(v) ?? undefined));

/**
 * One operation from JSON (section 8.4): every field's type, range and length is checked,
 * unknown fields are dropped, and optional ones become null, so equal operations compare equal.
 */
export function parseOperation(input: unknown): Parsed {
  const o = isRecord(input) ? input : {};
  if (o.formatVersion !== FORMAT_VERSION) {
    return Number.isInteger(o.formatVersion) ? { ok: false, code: 'unsupported-version', error: 'This record needs a newer version of the site.' } : { ok: false, error: 'Bad format version.' };
  }
  const id = parseRequestKey(o.id);
  if (!id) return { ok: false, error: 'Bad id.' };
  const raid = text(o.raid);
  if (!raid) return { ok: false, error: 'Bad raid.' };
  if (o.env !== 'production' && o.env !== 'staging') return { ok: false, error: 'Bad environment.' };
  if (!absent(o.practice) && typeof o.practice !== 'boolean') return { ok: false, error: 'Bad practice mark.' };
  if (typeof o.at !== 'number' || !Number.isSafeInteger(o.at) || o.at < 0 || o.at > MAX_AT) return { ok: false, error: 'Bad time.' };
  const common: Common = { id, formatVersion: FORMAT_VERSION, raid, env: o.env, practice: o.practice === true, at: o.at };

  if (o.type === 'award') {
    const boss = text(o.boss);
    if (!boss) return { ok: false, error: 'Bad boss.' };
    if (typeof o.item !== 'number' || !Number.isSafeInteger(o.item) || o.item < 1 || o.item >= MAX_ITEM_ID) return { ok: false, error: 'Bad item.' };
    const method = (LOOT_METHODS as readonly unknown[]).includes(o.method) ? (o.method as LootMethod) : null;
    if (!method) return { ok: false, error: 'Bad method.' };
    // Disenchant/bank has no winner, as in the loot log.
    const char = method === 'DISENCHANT_BANK' ? null : text(o.char);
    if (method !== 'DISENCHANT_BANK' && !char) return { ok: false, error: 'Bad character.' };
    const user = method === 'DISENCHANT_BANK' || absent(o.user) ? null : text(o.user);
    if (user === null && char && !absent(o.user)) return { ok: false, error: 'Bad user.' };
    if (!absent(o.roll) && !(Number.isInteger(o.roll) && (o.roll as number) >= 1 && (o.roll as number) <= 100)) return { ok: false, error: 'A roll is 1 to 100.' };
    const note = optionalText(o.note);
    if (note === undefined) return { ok: false, error: 'Bad note.' };
    const sender = text(o.sender);
    if (!sender) return { ok: false, error: 'Bad sender.' };
    return { ok: true, value: { ...common, type: 'award', boss, item: o.item, char, user, method, roll: absent(o.roll) ? null : (o.roll as number), note, sender } };
  }

  const key = parseRequestKey(o.key);
  if (!key || key === id) return { ok: false, error: 'Bad key.' };
  if (o.type === 'confirm' || o.type === 'not-confirmed') return { ok: true, value: { ...common, type: o.type, key } };
  if (o.type === 'void') {
    const reason = optionalText(o.reason);
    if (reason === undefined) return { ok: false, error: 'Bad reason.' };
    return { ok: true, value: { ...common, type: 'void', key, reason } };
  }
  if (o.type === 'replace') {
    const inner = parseOperation(o.award);
    if (!inner.ok) return inner;
    if (inner.value.type !== 'award' || inner.value.id === key || inner.value.id === id) return { ok: false, error: 'Bad replacement award.' };
    return { ok: true, value: { ...common, type: 'replace', key, award: inner.value } };
  }
  return { ok: false, error: 'Bad type.' };
}

/** The award an operation names: an award's own id, otherwise its key. */
export function keyOf(op: Operation): string {
  return op.type === 'award' ? op.id : op.key;
}

/** "The same payload" (section 4.2): every field except the times, which the site only stores. */
export function samePayload(a: Operation, b: Operation): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  // Sorted keys: a payload read back from Postgres jsonb has its keys reordered.
  if (isRecord(value)) return `{${Object.keys(value).filter((k) => k !== 'at').sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export type Confirmation = 'ANNOUNCED' | 'CONFIRMED' | 'NOT_CONFIRMED';
/** An award with a key. Loot-log awards are CONFIRMED with no `confirmedAt`. */
export type HeldAward = { raidId: string; voided: boolean; confirmation: Confirmation; confirmedAt: number | null };
export type Receipt = { op: Operation; status: 'PENDING' | 'APPLIED'; deliveredById: string; receivedAt: Date };
/**
 * What the site holds for one raid: awards by key and accepted receipts by operation id.
 * Keys and ids are unique across raids, so the writer also loads any held elsewhere under
 * the batch's ids and keys.
 */
export type LootState = { raidId: string; awards: Map<string, HeldAward>; receipts: Map<string, Receipt> };

export type Change =
  | { kind: 'receipt'; receipt: Receipt }
  | { kind: 'applied'; opId: string }
  | { kind: 'award'; award: AwardOperation; recordedById: string }
  | { kind: 'void'; key: string; voidedById: string; voidedAt: Date; reason: string | null }
  | { kind: 'confirmation'; key: string; confirmation: Confirmation; confirmedAt: number };

export type RejectCode =
  | 'wrong-environment' | 'unknown-raid' | 'practice-refused' | 'key-conflict'
  | 'raid-cancelled' | 'item-not-in-table' | 'unknown-boss' | 'unknown-character' | 'user-mismatch' | 'unknown-sender';
export type Outcome = { status: 'recorded' | 'replayed' | 'pending' | 'voided' } | { status: 'rejected'; code: RejectCode };

/** Section 2: the site's own environment and raid; practice records only on staging. */
function identityProblem(op: Operation, state: LootState, env: SiteEnv): RejectCode | null {
  for (const o of op.type === 'replace' ? [op, op.award] : [op]) {
    if (o.env !== env) return 'wrong-environment';
    if (o.raid !== state.raidId) return 'unknown-raid';
    if (o.practice && env === 'production') return 'practice-refused';
  }
  return null;
}

/**
 * Applies one operation by the table in section 4.2, updating `state` so the next
 * operation in the batch sees it. A rejection changes nothing. `site.check` refuses an award
 * the site can't record (section 5); a `replace` is checked on arrival, even when it would be
 * kept pending, so a held replacement never fails later.
 */
export function applyOperation(state: LootState, op: Operation, site: { env: SiteEnv; check?: (award: AwardOperation) => RejectCode | null }, from: { officerId: string; now: Date }): { outcome: Outcome; changes: Change[] } {
  const reject = (code: RejectCode) => ({ outcome: { status: 'rejected' as const, code }, changes: [] });
  const bad = identityProblem(op, state, site.env);
  if (bad) return reject(bad);
  const seen = state.receipts.get(op.id);
  if (seen) return samePayload(seen.op, op) ? { outcome: { status: 'replayed' }, changes: [] } : reject('key-conflict');

  const key = keyOf(op);
  const held = state.awards.get(key);
  // A key used on another raid, or (for an award, which would have a receipt) one the loot log holds.
  if (held && (held.raidId !== state.raidId || op.type === 'award')) return reject('key-conflict');
  // An award's key is also claimed by any replacement carrying it, pending or applied.
  const claimed = (award: AwardOperation) => {
    const own = state.receipts.get(award.id);
    if (own ? !samePayload(own.op, award) : state.awards.has(award.id)) return true;
    return [...state.receipts.values()].some((r) => r.op.type === 'replace' && r.op.award.id === award.id && !samePayload(r.op.award, award));
  };
  if (op.type === 'award' ? claimed(op) : op.type === 'replace' && claimed(op.award)) return reject('key-conflict');
  const refused = op.type === 'award' || op.type === 'replace' ? site.check?.(op.type === 'award' ? op : op.award) : null;
  if (refused) return reject(refused);

  const changes: Change[] = [];
  const receipt = keep(state, op, op.type === 'award' || held ? 'APPLIED' : 'PENDING', from.officerId, from.now, changes);
  if (op.type === 'award') {
    record(state, op, receipt, changes);
    return { outcome: { status: state.awards.get(key)!.voided ? 'voided' : 'recorded' }, changes };
  }
  if (!held) return { outcome: { status: 'pending' }, changes };
  correct(state, key, receipt, changes);
  return { outcome: { status: op.type === 'void' ? 'voided' : 'recorded' }, changes };
}

function keep(state: LootState, op: Operation, status: Receipt['status'], deliveredById: string, receivedAt: Date, changes: Change[]): Receipt {
  const receipt: Receipt = { op, status, deliveredById, receivedAt };
  state.receipts.set(op.id, receipt);
  changes.push({ kind: 'receipt', receipt });
  return receipt;
}

/** Records an award as announced, then applies what arrived for its key before it, oldest first. */
function record(state: LootState, award: AwardOperation, receipt: Receipt, changes: Change[]) {
  state.awards.set(award.id, { raidId: award.raid, voided: false, confirmation: 'ANNOUNCED', confirmedAt: null });
  changes.push({ kind: 'award', award, recordedById: receipt.deliveredById });
  const pending = [...state.receipts.values()]
    .filter((r) => r.status === 'PENDING' && r.op.raid === award.raid && keyOf(r.op) === award.id)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || (a.op.id < b.op.id ? -1 : 1));
  for (const r of pending) {
    r.status = 'APPLIED';
    changes.push({ kind: 'applied', opId: r.op.id });
    correct(state, award.id, r, changes);
  }
}

/** A confirmation, void or replacement on a held award (section 4.1). */
function correct(state: LootState, key: string, receipt: Receipt, changes: Change[]) {
  const award = state.awards.get(key)!;
  const { op } = receipt;
  if (op.type === 'confirm' || op.type === 'not-confirmed') {
    const next = op.type === 'confirm' ? 'CONFIRMED' : 'NOT_CONFIRMED';
    // The later game time wins; on a tie, confirmed wins.
    if (award.confirmedAt === null || op.at > award.confirmedAt || (op.at === award.confirmedAt && next === 'CONFIRMED')) {
      award.confirmation = next;
      award.confirmedAt = op.at;
      changes.push({ kind: 'confirmation', key, confirmation: next, confirmedAt: op.at });
    }
    return;
  }
  if (op.type === 'award') return;
  // The first void's reason and time stand.
  if (!award.voided) {
    award.voided = true;
    changes.push({ kind: 'void', key, voidedById: receipt.deliveredById, voidedAt: receipt.receivedAt, reason: op.type === 'void' ? op.reason : null });
  }
  if (op.type === 'replace' && !state.receipts.has(op.award.id) && !state.awards.has(op.award.id)) {
    // The new award arrived inside the replacement, so it carries that receipt's officer and time.
    record(state, op.award, keep(state, op.award, 'APPLIED', receipt.deliveredById, receipt.receivedAt, changes), changes);
  }
}
