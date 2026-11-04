/**
 * One-off cleanup: finds the made-up members and applications early seed runs left in a
 * database and, only when asked with the dry run's confirmation code, deletes them (#542).
 *
 *   npm run db:cleanup-samples                  dry run: lists everything, writes nothing
 *   npm run db:cleanup-samples -- --apply CODE  deletes exactly what the dry run listed
 *
 * The address comes from CLEANUP_DATABASE_URL only, set in the shell for the run. This file
 * reads no settings files and does not use the app's database client or the seed's write
 * guard, which keeps refusing production for the seed.
 *
 * A row is sample only when both its id and its name match what the seed builds; a row
 * matching one of them is listed as "not sure" and never touched. Anything a real person
 * owns or wrote that points at sample data blocks the delete until Robert decides on it.
 */
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@/lib/generated/prisma/client';
import { buildApplications, buildRoster } from './seed-data';

/** The seed's ids: `1000000000` / `2000000000` plus 8 digits (prisma/seed-data.ts, prisma/seed.ts). */
export const SAMPLE_MEMBER_ID = /^1000000000\d{8}$/;
export const SAMPLE_APPLICATION_ID = /^2000000000\d{8}$/;
const MEMBER_ID_PREFIX = '1000000000';
const APPLICATION_ID_PREFIX = '2000000000';

/** The seed stores each member's character name, lowercased, as the Discord name. */
export const SAMPLE_MEMBER_NAMES: ReadonlySet<string> = new Set(buildRoster().map((m) => m.name.toLowerCase()));
const pairKey = (discordName: string, character: string) => `${discordName}\u0000${character}`;
export const SAMPLE_APPLICATION_PAIRS: ReadonlySet<string> = new Set(buildApplications().map((a) => pairKey(a.discordName, a.character)));

export type MemberRow = { id: string; discordId: string; discordName: string };
export type ApplicationRow = { id: string; discordId: string; discordName: string; character: string; decidedByUserId: string | null };
export type Unsure = { kind: 'member' | 'application'; label: string; discordId: string; reason: string };

/** Splits candidate members into sample (id and name both match) and not sure (only one does). */
export function pickSampleMembers(rows: MemberRow[], names: ReadonlySet<string> = SAMPLE_MEMBER_NAMES) {
  const sample: MemberRow[] = [];
  const unsure: Unsure[] = [];
  for (const row of rows) {
    const idMatches = SAMPLE_MEMBER_ID.test(row.discordId);
    const nameMatches = names.has(row.discordName);
    if (idMatches && nameMatches) sample.push(row);
    else if (idMatches || nameMatches) unsure.push({ kind: 'member', label: row.discordName, discordId: row.discordId, reason: idMatches ? 'the id looks like a sample id but the name is not a sample name' : 'the name is a sample name but the id is not a sample id' });
  }
  return { sample, unsure };
}

/** The same for applications: the id and the (Discord name, character) pair must both match. */
export function pickSampleApplications(rows: ApplicationRow[], pairs: ReadonlySet<string> = SAMPLE_APPLICATION_PAIRS) {
  const sample: ApplicationRow[] = [];
  const unsure: Unsure[] = [];
  for (const row of rows) {
    const idMatches = SAMPLE_APPLICATION_ID.test(row.discordId);
    const pairMatches = pairs.has(pairKey(row.discordName, row.character));
    if (idMatches && pairMatches) sample.push(row);
    else if (idMatches || pairMatches) unsure.push({ kind: 'application', label: row.character, discordId: row.discordId, reason: idMatches ? 'the id looks like a sample id but the name is not a sample name' : 'the name is a sample name but the id is not a sample id' });
  }
  return { sample, unsure };
}

/** A short code for exactly this set of rows; any added, removed or changed id changes it. */
export function confirmationCode(ids: Iterable<string>): string {
  const sorted = [...new Set(ids)].sort();
  return createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 8).toUpperCase();
}

/** Rows that hang off the sample members and applications (or off a sample officer). */
export type Dependents = {
  characters: { id: string; userId: string; name: string }[];
  availability: { userId: string }[];
  /** Sign-ups of sample members, and sign-ups a sample officer set for anyone. */
  signups: { id: string; userId: string; setByUserId: string | null }[];
  /** Reserves of sample members or on sample characters. */
  reserves: { id: string; userId: string; characterId: string; setById: string | null }[];
  /** Awards to sample members or sample characters. */
  awards: { id: string; userId: string | null; characterId: string | null; characterName: string | null; itemId: number; recordedById: string }[];
  /** Notes written by sample members, and every note on a sample application. */
  notes: { id: string; applicationId: string; authorId: string }[];
  messages: { id: string; applicationId: string; authorUserId: string | null }[];
  interviews: { id: string; applicationId: string; requestedById: string; proposedById: string | null; bookedById: string | null; endedById: string | null }[];
  /** Applications that are not sample, decided by a sample officer. */
  decidedBySample: { id: string; character: string; decidedByUserId: string | null }[];
  /** Display names of the real accounts any of the above points at. */
  realNames: Map<string, string>;
};

type MemberSummary = { name: string; characters: number; availability: number; signups: number; reserves: number; awards: number; notes: number };
type ApplicationSummary = { name: string; notes: number; messages: number; interviews: number };

export type Plan = {
  members: MemberSummary[];
  applications: ApplicationSummary[];
  unsure: Unsure[];
  /** Real-owned records pointing at sample rows: apply refuses while any exist. */
  blocking: string[];
  /** Pointers the database clears or deletes with the sample rows; listed, never blocking. */
  info: string[];
  /** What apply deletes itself; everything else goes with these by the schema's cascades. */
  deletes: { userIds: string[]; applicationIds: string[]; awardIds: string[]; noteIds: string[] };
  /** Every row the delete removes, cascades included, as `table:id`. */
  rowIds: string[];
  totals: Record<'members' | 'characters' | 'availability' | 'signups' | 'reserves' | 'awards' | 'applications' | 'notes' | 'messages' | 'interviews', number>;
};

/** Sorts every dependent row into deleted with the sample, blocking, or for information. */
export function buildPlan(members: MemberRow[], applications: ApplicationRow[], unsure: Unsure[], d: Dependents): Plan {
  const memberIds = new Set(members.map((m) => m.id));
  const appIds = new Set(applications.map((a) => a.id));
  const isSample = (userId: string | null) => userId !== null && memberIds.has(userId);
  const sampleName = new Map(members.map((m) => [m.id, m.discordName]));
  const characterOwner = new Map(d.characters.map((c) => [c.id, c.userId]));
  const characterName = new Map(d.characters.map((c) => [c.id, c.name]));
  const appName = new Map(applications.map((a) => [a.id, a.character]));
  const who = (userId: string) => d.realNames.get(userId) ?? sampleName.get(userId) ?? `account ${userId}`;
  const blocking: string[] = [];
  const info: string[] = [];
  const rowIds = new Set<string>();
  const perMember = new Map(members.map((m) => [m.id, { name: m.discordName, characters: 0, availability: 0, signups: 0, reserves: 0, awards: 0, notes: 0 }]));
  const perApp = new Map(applications.map((a) => [a.id, { name: a.character, notes: 0, messages: 0, interviews: 0 }]));
  const awardIds: string[] = [];
  const noteIds: string[] = [];

  for (const c of d.characters) { perMember.get(c.userId)!.characters++; rowIds.add(`character:${c.id}`); }
  for (const a of d.availability) { perMember.get(a.userId)!.availability++; rowIds.add(`availability:${a.userId}`); }
  for (const s of d.signups) {
    if (isSample(s.userId)) {
      perMember.get(s.userId)!.signups++;
      rowIds.add(`signup:${s.id}`);
      if (s.setByUserId && !isSample(s.setByUserId)) info.push(`${who(s.userId)}'s raid signup was set by ${who(s.setByUserId)}; it is deleted with ${who(s.userId)}.`);
    } else if (isSample(s.setByUserId)) {
      info.push(`${who(s.userId)}'s raid signup was set by sample officer ${who(s.setByUserId!)}; only that "set by" link is cleared.`);
    }
  }
  for (const r of d.reserves) {
    const char = characterName.get(r.characterId) ?? 'a character';
    if (!isSample(r.userId)) blocking.push(`A reserve by real member ${who(r.userId)} on sample character ${char}.`);
    else if (r.setById && !isSample(r.setById)) blocking.push(`A reserve for ${char} (${who(r.userId)}) set by ${who(r.setById)}.`);
    else { perMember.get(r.userId)!.reserves++; rowIds.add(`reserve:${r.id}`); }
  }
  for (const a of d.awards) {
    const owner = a.userId && isSample(a.userId) ? a.userId : characterOwner.get(a.characterId ?? '');
    const char = a.characterName ?? characterName.get(a.characterId ?? '') ?? 'a sample member';
    if (!isSample(a.recordedById)) blocking.push(`A loot award (item ${a.itemId}) to ${char}, recorded by ${who(a.recordedById)}.`);
    else { perMember.get(owner!)!.awards++; awardIds.push(a.id); rowIds.add(`lootAward:${a.id}`); }
  }
  for (const n of d.notes) {
    if (appIds.has(n.applicationId)) {
      if (!isSample(n.authorId)) { blocking.push(`An officer note by ${who(n.authorId)} on sample application ${appName.get(n.applicationId)}.`); continue; }
      perApp.get(n.applicationId)!.notes++;
    } else {
      perMember.get(n.authorId)!.notes++;
      noteIds.push(n.id);
    }
    rowIds.add(`officerNote:${n.id}`);
  }
  for (const m of d.messages) {
    if (m.authorUserId && !isSample(m.authorUserId)) { blocking.push(`A message from ${who(m.authorUserId)} to sample applicant ${appName.get(m.applicationId)}.`); continue; }
    perApp.get(m.applicationId)!.messages++;
    rowIds.add(`applicantMessage:${m.id}`);
  }
  for (const i of d.interviews) {
    const real = [i.requestedById, i.proposedById, i.bookedById, i.endedById].find((id) => id && !isSample(id));
    if (real) { blocking.push(`An interview with sample applicant ${appName.get(i.applicationId)} involving ${who(real)}.`); continue; }
    perApp.get(i.applicationId)!.interviews++;
    rowIds.add(`interview:${i.id}`);
  }
  for (const a of applications) {
    rowIds.add(`application:${a.id}`);
    if (a.decidedByUserId && !isSample(a.decidedByUserId)) info.push(`Sample application ${a.character} was decided by ${who(a.decidedByUserId)}; it is deleted with the application.`);
  }
  for (const a of d.decidedBySample) info.push(`Application ${a.character} was decided by sample officer ${who(a.decidedByUserId!)}; only that "decided by" link is cleared.`);
  for (const m of members) rowIds.add(`user:${m.id}`);

  const memberList = [...perMember.values()];
  const appList = [...perApp.values()];
  const sum = <T>(list: T[], key: keyof T) => list.reduce((n, row) => n + (row[key] as number), 0);
  return {
    members: memberList,
    applications: appList,
    unsure,
    blocking,
    info,
    deletes: { userIds: [...memberIds], applicationIds: [...appIds], awardIds, noteIds },
    rowIds: [...rowIds],
    totals: {
      members: memberList.length, characters: sum(memberList, 'characters'), availability: sum(memberList, 'availability'),
      signups: sum(memberList, 'signups'), reserves: sum(memberList, 'reserves'), awards: sum(memberList, 'awards'),
      applications: appList.length, notes: sum(memberList, 'notes') + sum(appList, 'notes'),
      messages: sum(appList, 'messages'), interviews: sum(appList, 'interviews'),
    },
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function describeUnsure(plan: Plan): string[] {
  return [`Not sure, left alone: ${plan.unsure.length}`, ...plan.unsure.map((u) => `  ${u.kind} ${u.label} (Discord id ${u.discordId}): ${u.reason}`)];
}

/** The plan as plain lines, for Robert to read. */
export function describePlan(plan: Plan): string[] {
  const lines: string[] = [];
  const counts = (parts: Array<[number, string, string?]>) => parts.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many)).join(', ') || 'nothing attached';
  lines.push(`Sample members to delete: ${plan.members.length}`);
  for (const m of plan.members) lines.push(`  ${m.name}: ${counts([[m.characters, 'character'], [m.availability, 'availability week'], [m.signups, 'raid signup'], [m.reserves, 'reserve'], [m.awards, 'loot award'], [m.notes, 'officer note written']])}`);
  lines.push('', `Sample applications to delete: ${plan.applications.length}`);
  for (const a of plan.applications) lines.push(`  ${a.name}: ${counts([[a.notes, 'officer note'], [a.messages, 'message'], [a.interviews, 'interview']])}`);
  if (plan.unsure.length) lines.push('', ...describeUnsure(plan));
  if (plan.blocking.length) {
    lines.push('', `Real records pointing at sample data: ${plan.blocking.length}. Delete is refused while any remain.`);
    for (const b of plan.blocking) lines.push(`  ${b}`);
  }
  if (plan.info.length) {
    lines.push('', 'For information (does not block):');
    for (const i of plan.info) lines.push(`  ${i}`);
  }
  const t = plan.totals;
  lines.push('', `Total: ${plural(t.members, 'member')}, ${plural(t.characters, 'character')}, ${plural(t.availability, 'availability week')}, ${plural(t.signups, 'signup')}, ${plural(t.reserves, 'reserve')}, ${plural(t.awards, 'loot award')}, ${plural(t.applications, 'application')}, ${plural(t.notes, 'note')}, ${plural(t.messages, 'message')}, ${plural(t.interviews, 'interview')}.`);
  return lines;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Reads the candidates and everything attached to them. Read-only. */
export async function loadPlan(db: Db): Promise<Plan> {
  const memberRows = await db.user.findMany({
    where: { OR: [{ discordId: { startsWith: MEMBER_ID_PREFIX } }, { discordName: { in: [...SAMPLE_MEMBER_NAMES] } }] },
    select: { id: true, discordId: true, discordName: true },
  });
  const appRows = await db.application.findMany({
    where: { OR: [{ discordId: { startsWith: APPLICATION_ID_PREFIX } }, { character: { in: buildApplications().map((a) => a.character) } }] },
    select: { id: true, discordId: true, discordName: true, character: true, decidedByUserId: true },
  });
  const members = pickSampleMembers(memberRows);
  const applications = pickSampleApplications(appRows);
  const userIds = members.sample.map((m) => m.id);
  const appIds = applications.sample.map((a) => a.id);
  const characters = await db.character.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true, name: true } });
  const characterIds = characters.map((c) => c.id);
  const d: Dependents = {
    characters,
    availability: await db.availability.findMany({ where: { userId: { in: userIds } }, select: { userId: true } }),
    signups: await db.signup.findMany({ where: { OR: [{ userId: { in: userIds } }, { setByUserId: { in: userIds } }] }, select: { id: true, userId: true, setByUserId: true } }),
    reserves: await db.reserve.findMany({ where: { OR: [{ userId: { in: userIds } }, { characterId: { in: characterIds } }] }, select: { id: true, userId: true, characterId: true, setById: true } }),
    awards: await db.lootAward.findMany({ where: { OR: [{ userId: { in: userIds } }, { characterId: { in: characterIds } }] }, select: { id: true, userId: true, characterId: true, characterName: true, itemId: true, recordedById: true } }),
    notes: await db.officerNote.findMany({ where: { OR: [{ authorId: { in: userIds } }, { applicationId: { in: appIds } }] }, select: { id: true, applicationId: true, authorId: true } }),
    messages: await db.applicantMessage.findMany({ where: { applicationId: { in: appIds } }, select: { id: true, applicationId: true, authorUserId: true } }),
    interviews: await db.interview.findMany({ where: { applicationId: { in: appIds } }, select: { id: true, applicationId: true, requestedById: true, proposedById: true, bookedById: true, endedById: true } }),
    decidedBySample: await db.application.findMany({ where: { decidedByUserId: { in: userIds }, id: { notIn: appIds } }, select: { id: true, character: true, decidedByUserId: true } }),
    realNames: new Map(),
  };
  const sampleIds = new Set(userIds);
  const referenced = new Set<string>();
  for (const s of d.signups) for (const id of [s.userId, s.setByUserId]) if (id) referenced.add(id);
  for (const r of d.reserves) for (const id of [r.userId, r.setById]) if (id) referenced.add(id);
  for (const a of d.awards) referenced.add(a.recordedById);
  for (const n of d.notes) referenced.add(n.authorId);
  for (const m of d.messages) if (m.authorUserId) referenced.add(m.authorUserId);
  for (const a of applications.sample) if (a.decidedByUserId) referenced.add(a.decidedByUserId);
  for (const i of d.interviews) for (const id of [i.requestedById, i.proposedById, i.bookedById, i.endedById]) if (id) referenced.add(id);
  const realIds = [...referenced].filter((id) => !sampleIds.has(id));
  for (const u of await db.user.findMany({ where: { id: { in: realIds } }, select: { id: true, discordName: true } })) d.realNames.set(u.id, u.discordName);
  return buildPlan(members.sample, applications.sample, [...members.unsure, ...applications.unsure], d);
}

/** Deletes what the plan names; the schema's cascades take the rest. Run inside a transaction. */
async function applyPlan(tx: Prisma.TransactionClient, plan: Plan) {
  const { userIds, applicationIds, awardIds, noteIds } = plan.deletes;
  // Notes and awards first: notes would block the member delete, and awards would only lose their link.
  await tx.officerNote.deleteMany({ where: { id: { in: noteIds } } });
  await tx.lootAward.deleteMany({ where: { id: { in: awardIds } } });
  // Applications take their notes, messages and interviews; members their characters,
  // availability, signups and reserves.
  const apps = await tx.application.deleteMany({ where: { id: { in: applicationIds } } });
  const users = await tx.user.deleteMany({ where: { id: { in: userIds } } });
  return { applications: apps.count, members: users.count };
}

export type Args = { apply: false } | { apply: true; code: string } | { error: string };

export function parseArgs(argv: string[]): Args {
  if (argv.length === 0) return { apply: false };
  const [first, second, ...rest] = argv;
  const code = first.startsWith('--apply=') ? first.slice('--apply='.length) : first === '--apply' ? second : undefined;
  const extra = first.startsWith('--apply=') ? [second, ...rest].filter((a) => a !== undefined) : rest;
  if (!first.startsWith('--apply')) return { error: `Unknown option ${first}. Run with no options for the dry run, or --apply <code>.` };
  if (!code?.trim() || code.startsWith('--')) return { error: 'Delete needs the confirmation code from the dry run: --apply <code>. Nothing was deleted.' };
  if (extra.length) return { error: `Unknown option ${extra[0]}. Nothing was deleted.` };
  return { apply: true, code: code.trim().toUpperCase() };
}

class Refused extends Error {}

export async function main(argv: string[], url: string | undefined): Promise<number> {
  const args = parseArgs(argv);
  if ('error' in args) { console.error(args.error); return 1; }
  if (!url?.trim()) { console.error('Set CLEANUP_DATABASE_URL to the database address first. Nothing was read or written.'); return 1; }
  let db: PrismaClient;
  try {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.trim(), connectionTimeoutMillis: 10_000 }) });
    await db.$queryRaw`SELECT 1`;
  } catch {
    console.error('Could not reach the database in CLEANUP_DATABASE_URL. Check the address and try again. Nothing was written.');
    return 1;
  }
  try {
    if (!args.apply) {
      const plan = await loadPlan(db);
      if (plan.rowIds.length === 0) {
        console.log('Dry run, nothing changed. No sample members or applications found, so there is nothing to delete.');
        if (plan.unsure.length) console.log(['', ...describeUnsure(plan)].join('\n'));
        return 0;
      }
      console.log('Dry run, nothing changed.\n');
      console.log(describePlan(plan).join('\n'));
      const code = confirmationCode(plan.rowIds);
      if (plan.blocking.length) console.log(`\nConfirmation code: ${code}. Delete is refused until the real records above are dealt with.`);
      else console.log(`\nConfirmation code: ${code}\nTo delete exactly these: npm run db:cleanup-samples -- --apply ${code}`);
      return 0;
    }
    const result = await db.$transaction(async (tx) => {
      const plan = await loadPlan(tx);
      if (plan.rowIds.length === 0) return { plan, deleted: null };
      if (plan.blocking.length) throw new Refused(`Refused: ${plural(plan.blocking.length, 'real record points', 'real records point')} at sample data. Run the dry run to see them. Nothing was deleted.`);
      if (confirmationCode(plan.rowIds) !== args.code) throw new Refused('Refused: that code does not match the data now. Run the dry run again and use its new code. Nothing was deleted.');
      return { plan, deleted: await applyPlan(tx, plan) };
    }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 120_000 });
    if (!result.deleted) { console.log('No sample members or applications found. Nothing was deleted.'); return 0; }
    console.log('Deleted:\n');
    console.log(describePlan(result.plan).join('\n'));
    return 0;
  } catch (error) {
    if (error instanceof Refused) { console.error(error.message); return 1; }
    const code = typeof error === 'object' && error && 'code' in error ? ` (${String((error as { code: unknown }).code)})` : '';
    console.error(`The cleanup stopped with a database error${code}. Nothing was deleted.`);
    return 1;
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2), process.env.CLEANUP_DATABASE_URL).then((code) => { process.exitCode = code; });
}
