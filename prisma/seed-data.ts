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
import { GUILD_TIMEZONE } from '@/lib/config';
import type { Role as RaidRoleKey, WowClass as WowClassKey } from '@/lib/design/class-colors';
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

export type SeedRaid = { name: string; startsAt: Date; durationMin: number; requirements: Record<RaidRoleKey, number>; notes: string | null };

/** Three weeks of raids from `from`: the progression nights plus the optional Sunday. */
export function buildRaids(from = new Date()): SeedRaid[] {
  const names: Record<number, string> = { 2: 'Blackwing Lair', 3: 'Blackwing Lair', 0: 'Molten Core clear' };
  const raids: SeedRaid[] = [];
  for (let week = 0; week < 3; week++) {
    for (const night of RAID_NIGHTS) {
      const first = nextOccurrence(night.day as Weekday, night.start, GUILD_TIMEZONE, from);
      const startsAt = new Date(first.getTime() + week * 7 * 24 * 3600_000);
      raids.push({
        name: names[night.day] ?? night.kind,
        startsAt,
        durationMin: minutesBetween(night.start, night.end),
        requirements: night.optional ? { tank: 2, healer: 6, melee: 8, ranged: 10 } : { tank: 2, healer: 8, melee: 11, ranged: 14 },
        notes: night.optional ? 'Optional. Alts welcome once mains are in.' : week === 0 ? 'Chromaggus first. Read the breath rotation post.' : null,
      });
    }
  }
  return raids.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export type SeedNeed = { wowClass: WowClassKey; spec: string; roles: RaidRoleKey[]; status: 'HIGH' | 'MEDIUM' | 'CLOSED' };

/** Class needs expanded to one row per spec, matching the schema's unique [class, spec]. All roles kept. */
export function buildClassNeeds(): SeedNeed[] {
  const rows: SeedNeed[] = [];
  for (const n of CLASS_NEEDS) {
    for (const spec of n.specs) {
      rows.push({ wowClass: n.wowClass, spec, roles: [...n.roles], status: n.status.toUpperCase() as SeedNeed['status'] });
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
};

/** Seven pending applications (the officer stub's badge count) plus a few decided ones. */
export function buildApplications(): SeedApplication[] {
  const pending: Array<[string, WowClassKey, string, string]> = [
    ['Footnote', 'priest', 'Holy', 'Pulled early on Vael. Now I wait for the call, every time.'],
    ['Loophole', 'warrior', 'Protection', 'Taunted off the wrong tank on Broodlord. I read the swap order out loud now.'],
    ['Indexcard', 'shaman', 'Restoration', 'Stood in the wrong spot on Firemaw. I moved my camera and never did it again.'],
    ['Smallprint', 'druid', 'Restoration', 'Went oom on Ebonroc because I panic-healed. I learned to hold cooldowns.'],
    ['Backlog', 'priest', 'Shadow', 'Missed a dispel on Chromaggus. I made a dispel macro that night.'],
    ['Redline', 'warlock', 'Destruction', 'Pulled aggro on trash three times. I started watching threat instead of the meter.'],
    ['Fineprint', 'mage', 'Frost', 'Decursed the wrong target set. I sorted my raid frames by group.'],
  ];
  const apps: SeedApplication[] = pending.map(([character, wowClass, spec, wipe], i) => ({
    path: 'RAIDER',
    status: 'PENDING',
    discordName: character.toLowerCase(),
    character,
    wowClass,
    spec,
    logsUrl: `https://logs.example.com/reports/${character.toLowerCase()}`,
    answers: { availability: i % 5 === 4 ? 'One of them' : 'Both nights', wipe },
    daysAgo: i,
    read: i > 3,
  }));
  apps.push(
    { path: 'SOCIAL', status: 'PENDING', discordName: 'sidebar', character: 'Sidebar', wowClass: null, spec: null, logsUrl: null, answers: { note: 'Friend of Paperclip. Alt runs on weekends.' }, daysAgo: 2, read: true },
    { path: 'RAIDER', status: 'ACCEPTED', discordName: 'stapler', character: 'Stapler', wowClass: 'mage', spec: 'Frost', logsUrl: 'https://logs.example.com/reports/stapler', answers: { availability: 'Both nights', wipe: 'Stood in a void zone. Once.' }, daysAgo: 12, read: true },
    { path: 'RAIDER', status: 'DECLINED', discordName: 'typo', character: 'Typo', wowClass: 'rogue', spec: 'Combat', logsUrl: 'https://logs.example.com/reports/typo', answers: { availability: 'Neither', wipe: 'n/a' }, daysAgo: 20, read: true },
  );
  return apps;
}
