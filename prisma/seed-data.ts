/**
 * Deterministic seed data: a realistic 41-person roster with a painted week each, three
 * weeks of raids with sign-ups, class needs, and an applications inbox. Pure functions,
 * so the shape of the roster is unit-tested without a database.
 *
 * Every name is PLACEHOLDER (design-handover/CLAUDE.md). Real members replace them
 * through the roster sync later.
 */
import { CLASS_NEEDS } from '@/content/recruitment';
import { RAID_NIGHTS } from '@/content/schedule';
import { NEED_SPECS } from '@/lib/class-needs';
import { GUILD_TIMEZONE } from '@/lib/config';
import type { CompositionRole, Role as RaidRoleKey, WowClass as WowClassKey } from '@/lib/design/class-colors';
import { minutesBetween, nextOccurrence, zonedParts, type Weekday } from '@/lib/time';

/** Small seeded PRNG (mulberry32) so every run produces the same roster. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SeedRank = 'OFFICER' | 'RAIDER' | 'TRIAL' | 'SOCIAL';
export type SeedRole = 'SOCIAL' | 'MEMBER' | 'OFFICER';

export type SeedAlt = { name: string; wowClass: WowClassKey; spec: string; raidRole: RaidRoleKey };

export type SeedMember = {
  name: string;
  discordId: string;
  wowClass: WowClassKey;
  spec: string;
  raidRole: RaidRoleKey;
  rank: SeedRank;
  role: SeedRole;
  timezone: string;
  /** 0–1 */
  attendance: number;
  joinedDaysAgo: number;
  alts: SeedAlt[];
};

/** Bureaucratic character names. The first ten are the handover's own placeholders. */
const NAMES = [
  'Ledgerline', 'Redtape', 'Subclause', 'Paperclip', 'Formfiller', 'Memoranda', 'Rubberstamp', 'Triplicate', 'Quorum', 'Addendum',
  'Docket', 'Notary', 'Affidavit', 'Codicil', 'Manifest', 'Protocol', 'Statute', 'Waiver', 'Auditrix', 'Binder',
  'Ballot', 'Charter', 'Decree', 'Dossier', 'Escrow', 'Gazette', 'Indent', 'Journal', 'Lienholder', 'Mandate',
  'Ordinance', 'Permit', 'Quittance', 'Receipt', 'Riderclause', 'Tariff', 'Treaty', 'Voucher', 'Writ', 'Carboncopy',
  'Stapler',
];

/** A 40-player composition plus one social. Roles per docs/06 seed hint: 3T · 10H · 12M · 15R. */
const SLOTS: Array<[WowClassKey, string, RaidRoleKey]> = [
  ['warrior', 'Protection', 'tank'],
  ['warrior', 'Protection', 'tank'],
  ['druid', 'Feral', 'tank'],
  ['priest', 'Holy', 'healer'],
  ['priest', 'Holy', 'healer'],
  ['priest', 'Discipline', 'healer'],
  ['priest', 'Holy', 'healer'],
  ['paladin', 'Holy', 'healer'],
  ['paladin', 'Holy', 'healer'],
  ['druid', 'Restoration', 'healer'],
  ['druid', 'Restoration', 'healer'],
  ['shaman', 'Restoration', 'healer'],
  ['shaman', 'Restoration', 'healer'],
  ['warrior', 'Fury', 'melee'],
  ['warrior', 'Fury', 'melee'],
  ['warrior', 'Fury', 'melee'],
  ['warrior', 'Arms', 'melee'],
  ['rogue', 'Combat', 'melee'],
  ['rogue', 'Combat', 'melee'],
  ['rogue', 'Combat', 'melee'],
  ['rogue', 'Assassination', 'melee'],
  ['warrior', 'Fury', 'melee'],
  ['rogue', 'Combat', 'melee'],
  ['shaman', 'Enhancement', 'melee'],
  ['warrior', 'Fury', 'melee'],
  ['mage', 'Frost', 'ranged'],
  ['mage', 'Frost', 'ranged'],
  ['mage', 'Fire', 'ranged'],
  ['mage', 'Frost', 'ranged'],
  ['warlock', 'Destruction', 'ranged'],
  ['warlock', 'Destruction', 'ranged'],
  ['warlock', 'Affliction', 'ranged'],
  ['warlock', 'Destruction', 'ranged'],
  ['hunter', 'Marksmanship', 'ranged'],
  ['hunter', 'Marksmanship', 'ranged'],
  ['hunter', 'Beast Mastery', 'ranged'],
  ['priest', 'Shadow', 'ranged'],
  ['shaman', 'Elemental', 'ranged'],
  ['druid', 'Balance', 'ranged'],
  ['mage', 'Fire', 'ranged'],
  ['mage', 'Frost', 'ranged'], // the social: an alt-runner, not on the raid team
];

const ZONES = ['America/Chicago', 'America/New_York', 'America/Los_Angeles', 'America/Denver', 'Europe/London', 'Europe/Berlin', 'America/Phoenix'];

/** The 41-person roster. Deterministic. */
export function buildRoster(): SeedMember[] {
  const random = rng(20261104);
  return SLOTS.map(([wowClass, spec, raidRole], i) => {
    const name = NAMES[i];
    const isOfficer = i < 3; // Ledgerline (GM), Redtape (healing), Subclause (recruitment) — the About page officers
    const isSocial = i === SLOTS.length - 1;
    const isTrial = !isOfficer && !isSocial && i % 9 === 8;
    const rank: SeedRank = isOfficer ? 'OFFICER' : isSocial ? 'SOCIAL' : isTrial ? 'TRIAL' : 'RAIDER';
    const role: SeedRole = isOfficer ? 'OFFICER' : isSocial ? 'SOCIAL' : 'MEMBER';
    // Mostly US Central; a few coasts and two Europeans.
    const zone = i % 7 === 4 ? ZONES[4] : i % 11 === 5 ? ZONES[5] : ZONES[[0, 0, 1, 2, 0, 3, 0, 6][i % 8]];
    return {
      name,
      // 18-digit snowflake-shaped ids, built as strings to stay off BigInt.
      discordId: `1000000000${String(10_000_000 + i * 7919).padStart(8, '0')}`,
      wowClass,
      spec,
      raidRole,
      rank,
      role,
      timezone: zone,
      attendance: isSocial ? 0 : isTrial ? 0.7 + random() * 0.2 : 0.82 + random() * 0.18,
      joinedDaysAgo: isTrial ? Math.floor(random() * 14) : 30 + Math.floor(random() * 700),
      // Invented stationery-themed characters; Redtape is the member-session fixture.
      alts: i === 0 ? [
        { name: 'Inkwell', wowClass: 'mage', spec: 'Frost', raidRole: 'ranged' },
        { name: 'Sealwax', wowClass: 'priest', spec: 'Holy', raidRole: 'healer' },
      ] : i === 1 ? [
        { name: 'Blotter', wowClass: 'warlock', spec: 'Affliction', raidRole: 'ranged' },
        { name: 'Carbonleaf', wowClass: 'rogue', spec: 'Combat', raidRole: 'melee' },
        { name: 'Deskstamp', wowClass: 'paladin', spec: 'Holy', raidRole: 'healer' },
        { name: 'Filetab', wowClass: 'hunter', spec: 'Beast Mastery', raidRole: 'ranged' },
        { name: 'Inktray', wowClass: 'shaman', spec: 'Restoration', raidRole: 'healer' },
        { name: 'Quillcase', wowClass: 'druid', spec: 'Feral', raidRole: 'tank' },
        { name: 'Waxseal', wowClass: 'warrior', spec: 'Fury', raidRole: 'melee' },
      ] : [],
    };
  });
}

/** The officers' seat on the About page, in this order. */
export function officerNames(roster: SeedMember[]): string[] {
  return roster.filter((m) => m.rank === 'OFFICER').map((m) => m.name);
}

export type SlotState = 'available' | 'if-needed';
export type Week = Record<string, SlotState>;

/** Monday-first day index from a JS weekday (Sunday = 0). */
export function mondayIndex(jsWeekday: number): number {
  return (jsWeekday + 6) % 7;
}

/**
 * A member's painted week in their own zone: every raid night's guild-time window converted
 * to local day/slot pairs, plus some if-needed spill around it. Slot 0 = 00:00, 47 = 23:30.
 */
export function paintWeek(zone: string, random: () => number, from = new Date()): Week {
  const week: Week = {};
  const mark = (day: number, slot: number, state: SlotState) => {
    const key = `${day}:${slot}`;
    if (state === 'available' || !week[key]) week[key] = state;
  };
  for (const night of RAID_NIGHTS) {
    const start = nextOccurrence(night.day as Weekday, night.start, GUILD_TIMEZONE, from);
    const halfHours = minutesBetween(night.start, night.end) / 30;
    for (let i = -2; i < halfHours + 2; i++) {
      const t = new Date(start.getTime() + i * 30 * 60_000);
      const p = zonedParts(t, zone);
      const day = mondayIndex(p.weekday);
      const slot = p.hour * 2 + (p.minute >= 30 ? 1 : 0);
      const inside = i >= 0 && i < halfHours;
      if (night.optional) {
        if (inside && random() < 0.6) mark(day, slot, random() < 0.7 ? 'available' : 'if-needed');
      } else if (inside) {
        mark(day, slot, random() < 0.93 ? 'available' : 'if-needed');
      } else if (random() < 0.5) {
        mark(day, slot, 'if-needed');
      }
    }
  }
  return week;
}

/** `template` names the SeedTemplate the raid belongs to, so reserves and the loot log have a table. */
export type SeedRaid = { name: string; template: string; startsAt: Date; durationMin: number; requirements: Record<CompositionRole, number>; notes: string | null };

/** Three weeks of raids from `from`: the progression nights. */
export function buildRaids(from = new Date()): SeedRaid[] {
  const names: Record<number, string> = { 2: "Onyxia's Lair", 4: "Onyxia's Lair", 0: 'Hyjal Summit clear' };
  const templates: Record<number, string> = { 2: "Onyxia's Lair", 4: "Onyxia's Lair", 0: 'Hyjal Summit' };
  const raids: SeedRaid[] = [];
  for (let week = 0; week < 3; week++) {
    for (const night of RAID_NIGHTS) {
      const first = nextOccurrence(night.day as Weekday, night.start, GUILD_TIMEZONE, from);
      const startsAt = new Date(first.getTime() + week * 7 * 24 * 3600_000);
      raids.push({
        name: names[night.day] ?? night.kind,
        template: templates[night.day] ?? "Onyxia's Lair",
        startsAt,
        durationMin: minutesBetween(night.start, night.end),
        requirements: night.optional ? { tank: 2, healer: 3, dps: 15 } : { tank: 3, healer: 12, dps: 25 },
        notes: night.optional ? 'Optional. Alts welcome once mains are in.' : week === 0 ? 'Read the assignment notes before the first pull.' : null,
      });
    }
  }
  return raids.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export type SeedNeed = { wowClass: WowClassKey; spec: string; roles: RaidRoleKey[]; status: 'HIGH' | 'MEDIUM' | 'CLOSED' };

/**
 * Class needs expanded to one row per need spec (a two-role spec is two rows), matching the
 * schema's unique [class, spec].
 */
export function buildClassNeeds(): SeedNeed[] {
  const rows: SeedNeed[] = [];
  for (const n of CLASS_NEEDS) {
    for (const s of NEED_SPECS[n.wowClass]) {
      if (!n.specs.includes(s.spec) || !s.roles.some((r) => n.roles.includes(r))) continue;
      rows.push({ wowClass: n.wowClass, spec: s.name, roles: [...s.roles], status: n.status.toUpperCase() as SeedNeed['status'] });
    }
  }
  return rows;
}

export type SeedApplication = {
  path: 'RAIDER' | 'SOCIAL';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  discordName: string;
  character: string;
  wowClass: WowClassKey | null;
  spec: string | null;
  logsUrl: string | null;
  answers: Record<string, string>;
  daysAgo: number;
  read: boolean;
  /** Oldest attempt first. Sample interviews, one per state of the officer Interview card. */
  interviews?: SeedInterview[];
  /** Sample relay messages, oldest first; `afterMin` is minutes after the application. */
  messages?: SeedMessage[];
};

export type SeedMessage = {
  direction: 'TO_APPLICANT' | 'FROM_APPLICANT';
  body: string;
  afterMin: number;
  status?: 'QUEUED' | 'SENT' | 'NOT_DELIVERED' | 'NOT_SENT';
  attachments?: number;
  /** Has a Discord copy in the thread, so the attachment note links to it. */
  copy?: boolean;
  edited?: boolean;
  deleted?: boolean;
};

const HOUR = 60;
/** `count` consecutive half-hour starts from `startMin`. */
const halfHours = (startMin: number, count: number) => Array.from({ length: count }, (_, i) => startMin + i * 30);
/** The times an applicant sent: tomorrow evening and the day after, minutes from now. */
const SAMPLE_TIMES = [...halfHours(26 * HOUR, 6), ...halfHours(50 * HOUR, 4)];

/** One of each row the notes list can show, on a read application that already has a note. */
const SAMPLE_MESSAGES: Record<string, SeedMessage[]> = {
  Backlog: [
    { direction: 'TO_APPLICANT', body: 'Thanks for applying. Which nights can you raid?', afterMin: 4 * HOUR, status: 'SENT' },
    { direction: 'FROM_APPLICANT', body: 'Both nights. Here is my UI setup.', afterMin: 5 * HOUR, attachments: 1, copy: true },
    { direction: 'FROM_APPLICANT', body: 'Sorry, ignore that last question about gear.', afterMin: 6 * HOUR, deleted: true },
    { direction: 'FROM_APPLICANT', body: 'I can also bring consumables every week.', afterMin: 7 * HOUR, edited: true, attachments: 2 },
    { direction: 'TO_APPLICANT', body: 'Great, we will book a short chat soon.', afterMin: 8 * HOUR, status: 'NOT_DELIVERED' },
    { direction: 'TO_APPLICANT', body: 'Sending this one again.', afterMin: 9 * HOUR, status: 'NOT_SENT' },
  ],
};

/**
 * An interview attempt with every moment as minutes from the seed's half-hour-rounded "now"
 * (negative is the past) and officers as indexes into the seeded officers (Ledgerline,
 * Redtape, Subclause). Sample data only; the rows enqueue nothing for the bot.
 */
export type SeedInterview = {
  status: 'AWAITING_TIMES' | 'TIMES_RECEIVED' | 'PROPOSED' | 'BOOKED' | 'DONE' | 'CANCELLED' | 'NO_TIME' | 'CLOSED';
  endReason?: 'DECLINED';
  requestedMin: number;
  slotMins?: number[];
  timesUpdatedMin?: number;
  proposed?: { startMin: number; by: number };
  booked?: { startMin: number; by: number };
  ended?: { min: number; by: number | null };
};

const SAMPLE_INTERVIEWS: Record<string, SeedInterview[]> = {
  Loophole: [{ status: 'AWAITING_TIMES', requestedMin: -90 }],
  Indexcard: [{ status: 'TIMES_RECEIVED', requestedMin: -26 * HOUR, slotMins: SAMPLE_TIMES, timesUpdatedMin: -5 * HOUR }],
  Smallprint: [{ status: 'PROPOSED', requestedMin: -48 * HOUR, slotMins: SAMPLE_TIMES, timesUpdatedMin: -30 * HOUR, proposed: { startMin: 30 * HOUR, by: 1 } }],
  Backlog: [{ status: 'BOOKED', requestedMin: -40 * HOUR, slotMins: SAMPLE_TIMES, timesUpdatedMin: -30 * HOUR, booked: { startMin: 26 * HOUR, by: 0 } }],
  Redline: [{ status: 'DONE', requestedMin: -110 * HOUR, slotMins: SAMPLE_TIMES.map((m) => m - 100 * HOUR), timesUpdatedMin: -100 * HOUR, booked: { startMin: -74 * HOUR, by: 0 }, ended: { min: -73 * HOUR, by: null } }],
  Fineprint: [{ status: 'DONE', requestedMin: -140 * HOUR, slotMins: SAMPLE_TIMES.map((m) => m - 125 * HOUR), timesUpdatedMin: -128 * HOUR, booked: { startMin: -99 * HOUR, by: 2 }, ended: { min: -98 * HOUR, by: null } }, { status: 'AWAITING_TIMES', requestedMin: -3 * HOUR }],
};

/** Seven pending applications (the officer stub's badge count) plus a few decided ones. */
export function buildApplications(): SeedApplication[] {
  const pending: Array<[string, WowClassKey, string, string]> = [
    ['Footnote', 'priest', 'Holy', 'I heal to the plan, not the meter, and I never miss a raid night.'],
    ['Loophole', 'warrior', 'Protection', 'Tanked every Classic tier. I know the swap orders and I call my own taunts.'],
    ['Indexcard', 'shaman', 'Restoration', 'Chain heal, totems on time, and I read the fight before I show up.'],
    ['Smallprint', 'druid', 'Restoration', 'I manage mana well and I am happy on innervate duty for the whole night.'],
    ['Backlog', 'priest', 'Shadow', 'Shadow weaving uptime is my job and I take it seriously. Dispels too.'],
    ['Redline', 'warlock', 'Destruction', 'I watch threat before damage, and I bring my own consumables every week.'],
    ['Fineprint', 'mage', 'Frost', 'Fast decurses, sorted raid frames and a calm voice on comms.'],
  ];
  const apps: SeedApplication[] = pending.map(([character, wowClass, spec, pitch], i) => ({
    path: 'RAIDER',
    status: 'PENDING',
    discordName: character.toLowerCase(),
    character,
    wowClass,
    spec,
    logsUrl: `https://logs.example.com/reports/${character.toLowerCase()}`,
    answers: { availability: i % 5 === 4 ? 'One of them' : 'Both nights', pitch },
    daysAgo: i,
    read: i > 3,
    interviews: SAMPLE_INTERVIEWS[character],
    messages: SAMPLE_MESSAGES[character],
  }));
  apps.push(
    { path: 'SOCIAL', status: 'PENDING', discordName: 'sidebar', character: 'Sidebar', wowClass: null, spec: null, logsUrl: null, answers: { note: 'Friend of Paperclip. Alt runs on weekends.' }, daysAgo: 2, read: true, interviews: [{ status: 'NO_TIME', endReason: 'DECLINED', requestedMin: -44 * HOUR, slotMins: SAMPLE_TIMES.map((m) => m - 60 * HOUR), timesUpdatedMin: -40 * HOUR, proposed: { startMin: -2 * HOUR, by: 1 }, ended: { min: -4 * HOUR, by: null } }] },
    { path: 'RAIDER', status: 'ACCEPTED', discordName: 'stapler', character: 'Stapler', wowClass: 'mage', spec: 'Frost', logsUrl: 'https://logs.example.com/reports/stapler', answers: { availability: 'Both nights', pitch: 'I show up prepared and I stay out of the void zones.' }, daysAgo: 12, read: true, interviews: [{ status: 'CLOSED', requestedMin: -11 * 24 * HOUR, slotMins: SAMPLE_TIMES.map((m) => m - 10 * 24 * HOUR), timesUpdatedMin: -10 * 24 * HOUR, ended: { min: -10 * 24 * HOUR, by: 0 } }] },
    { path: 'RAIDER', status: 'DECLINED', discordName: 'typo', character: 'Typo', wowClass: 'rogue', spec: 'Combat', logsUrl: 'https://logs.example.com/reports/typo', answers: { availability: 'Neither', pitch: 'n/a' }, daysAgo: 20, read: true, interviews: [{ status: 'CANCELLED', requestedMin: -19 * 24 * HOUR, slotMins: SAMPLE_TIMES.map((m) => m - 19 * 24 * HOUR), timesUpdatedMin: -19 * 24 * HOUR + 2 * HOUR, booked: { startMin: 26 * HOUR - 19 * 24 * HOUR, by: 0 }, ended: { min: -18 * 24 * HOUR - 2 * HOUR, by: 1 } }] },
  );
  return apps;
}

export type SeedTemplate = { name: string; short: string; size: number; durationMin: number; requirements: Record<CompositionRole, number> };

/** SYNC-SPEC §3: mirrors the raid templates configured in production. Order is tank/healer/DPS. */
export function buildRaidTemplates(): SeedTemplate[] {
  return [
    { name: 'Barrow Deeps', short: 'BD', size: 10, durationMin: 180, requirements: { tank: 2, healer: 2, dps: 6 } },
    { name: 'Hyjal Summit', short: 'HS', size: 20, durationMin: 180, requirements: { tank: 2, healer: 3, dps: 15 } },
    { name: "Onyxia's Lair", short: 'Ony', size: 40, durationMin: 60, requirements: { tank: 3, healer: 12, dps: 25 } },
  ];
}
