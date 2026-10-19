/**
 * Seed: wipes and refills the database with the deterministic roster, availability,
 * raids, sign-ups, class needs and applications from ./seed-data. Run with
 * `npm run db:seed` (prisma db seed → tsx prisma/seed.ts) for a local database, or
 * `npm run db:staging:seed` for staging. It deletes everything first, so it refuses any
 * other target; see ./write-guard.ts.
 */
import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { assertWriteTarget } from './write-guard';
import { parseStagingTesters } from './staging-testers';
import { buildApplications, buildClassNeeds, buildRaids, buildRaidTemplates, buildRoster, paintWeek, rng } from './seed-data';

loadEnv({ path: '.env.local' });
loadEnv();

const CLASS = {
  warrior: 'WARRIOR', paladin: 'PALADIN', hunter: 'HUNTER', rogue: 'ROGUE', priest: 'PRIEST',
  shaman: 'SHAMAN', mage: 'MAGE', warlock: 'WARLOCK', druid: 'DRUID',
} as const;
const RAID_ROLE = { tank: 'TANK', healer: 'HEALER', melee: 'MELEE', ranged: 'RANGED' } as const;

/** Invented ids, names and colours for the tags in the first sample note. */
const SAMPLE_MENTIONS = {
  users: { '1000000000000000004': { name: 'Marginalia' } },
  roles: { '1000000000000000001': { name: 'Raid Leader', color: 0xe67e22 } },
  channels: { '1000000000000000002': { name: 'officer-chat' } },
};

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be set');
  const target = assertWriteTarget(connectionString);
  console.log(`Seeding the ${target} database.`);
  const roster = buildRoster();
  const testers = parseStagingTesters(process.env.STAGING_TESTERS, roster);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const now = new Date();
  const random = rng(20261104);
  // Sample interview moments are minutes from the next half hour.
  const base = new Date(Math.ceil(now.getTime() / 1_800_000) * 1_800_000);

  // Wipe in dependency order.
  await db.botRequest.deleteMany();
  await db.outboxJob.deleteMany();
  await db.applicantMessage.deleteMany();
  await db.officerNote.deleteMany();
  await db.application.deleteMany();
  await db.signup.deleteMany();
  // Loot tables go with their templates; the item cache stays, it only mirrors Wowhead.
  await db.lootAward.deleteMany();
  await db.reserve.deleteMany();
  await db.raid.deleteMany();
  await db.raidSeries.deleteMany();
  await db.raidTemplate.deleteMany();
  await db.availability.deleteMany();
  await db.character.deleteMany();
  await db.classNeed.deleteMany();
  await db.user.deleteMany();

  // Roster: one user, one main character, one painted week each.
  const users: Array<{ id: string; characterId: string; role: string; raidRole: string; timezone: string; name: string }> = [];
  for (const m of roster) {
    const user = await db.user.create({
      data: {
        discordId: m.discordId,
        discordName: m.name.toLowerCase(),
        role: m.role,
        rank: m.rank,
        inGuild: m.role !== 'SOCIAL',
        timezone: m.timezone,
        createdAt: new Date(now.getTime() - m.joinedDaysAgo * 86_400_000),
        characters: {
          create: {
            name: m.name,
            class: CLASS[m.wowClass],
            spec: m.spec,
            raidRole: RAID_ROLE[m.raidRole],
            rank: m.rank,
            attendance: m.attendance,
            joinedAt: new Date(now.getTime() - m.joinedDaysAgo * 86_400_000),
          },
        },
      },
      include: { characters: { select: { id: true } } },
    });
    users.push({ id: user.id, characterId: user.characters[0].id, role: m.role, raidRole: m.raidRole, timezone: m.timezone, name: m.name });
    // Keep the main's id above for signups; extra sample characters are never mains.
    if (m.alts.length) await db.character.createMany({
      data: m.alts.map((alt) => ({ userId: user.id, name: alt.name, class: CLASS[alt.wowClass], spec: alt.spec, raidRole: RAID_ROLE[alt.raidRole], rank: m.rank, isMain: false })),
    });
    // Most members have painted; a few have not (drives the "Not submitted" states).
    if (m.role !== 'SOCIAL' && random() < 0.88) {
      await db.availability.create({ data: { userId: user.id, timezone: m.timezone, slots: paintWeek(m.timezone, random, now) } });
    }
  }

  // Raid templates (SYNC-SPEC §3). Series are created by officers, not seeded.
  const templateIds = new Map<string, string>();
  for (const t of buildRaidTemplates()) {
    templateIds.set(t.name, (await db.raidTemplate.create({ data: t, select: { id: true } })).id);
  }

  // Raids and sign-ups: the upcoming week is mostly answered, later weeks sparsely.
  const raids = buildRaids(now);
  for (const [i, r] of raids.entries()) {
    const raid = await db.raid.create({ data: { name: r.name, startsAt: r.startsAt, locksAt: new Date(r.startsAt.getTime() - 120 * 60_000), durationMin: r.durationMin, requirements: r.requirements, notes: r.notes, templateId: templateIds.get(r.template) ?? null } });
    const answerRate = i < 3 ? 0.9 : i < 6 ? 0.45 : 0.15;
    for (const u of users) {
      if (u.role === 'SOCIAL' || random() > answerRate) continue;
      const roll = random();
      const response = roll < 0.82 ? 'ACCEPT' : roll < 0.93 ? 'TENTATIVE' : 'ABSENT';
      await db.signup.create({
        data: {
          raidId: raid.id,
          userId: u.id,
          characterId: u.characterId,
          response,
          source: random() < 0.6 ? 'WEB' : 'DISCORD',
          reason: response === 'ABSENT' ? ['Work trip.', 'Family dinner.', 'Exam week.'][Math.floor(random() * 3)] : null,
        },
      });
    }
  }

  // Class needs: the recruitment table, one row per spec.
  for (const n of buildClassNeeds()) {
    await db.classNeed.create({ data: { class: CLASS[n.wowClass], spec: n.spec, roles: n.roles.map((r) => RAID_ROLE[r]), status: n.status } });
  }

  // Applications, with officer notes on the read ones.
  const officers = users.filter((u) => u.role === 'OFFICER');
  // The first sample note carries stored tag names, as the bot sends them; the rest show the fallback.
  let notesWithMentions = 0;
  for (const a of buildApplications()) {
    const createdAt = new Date(now.getTime() - a.daysAgo * 86_400_000);
    const app = await db.application.create({
      data: {
        path: a.path,
        status: a.status,
        discordId: `2000000000${String(10_000_000 + a.character.length * 131 + a.daysAgo).padStart(8, '0')}`,
        discordName: a.discordName,
        character: a.character,
        class: a.wowClass ? CLASS[a.wowClass] : null,
        spec: a.spec,
        logsUrl: a.logsUrl,
        answers: a.answers,
        createdAt,
        readAt: a.read ? new Date(createdAt.getTime() + 3600_000) : null,
        decidedAt: a.status === 'PENDING' ? null : new Date(createdAt.getTime() + 2 * 86_400_000),
        decidedByUserId: a.status === 'PENDING' ? null : officers[0].id,
      },
    });
    if (a.read && a.path === 'RAIDER') {
      await db.officerNote.create({
        data: { applicationId: app.id, authorId: officers[2].id, body: `Logs look clean. Deaths avoided more than damage done.\nAsking <@${roster[0].discordId}> and <@&1000000000000000001> to look in <#1000000000000000002> <:pepe:1000000000000000003>. Also <@1000000000000000004>.`, createdAt: new Date(createdAt.getTime() + 2 * 3600_000), mentions: notesWithMentions++ === 0 ? SAMPLE_MENTIONS : undefined },
      });
    }
    for (const m of a.messages ?? []) {
      const to = m.direction === 'TO_APPLICANT';
      await db.applicantMessage.create({
        data: {
          applicationId: app.id,
          direction: m.direction,
          authorUserId: to ? officers[0].id : null,
          body: m.body,
          createdAt: new Date(createdAt.getTime() + m.afterMin * 60_000),
          status: to ? (m.status ?? 'SENT') : null,
          copyChannelId: m.copy ? '3000000000000000001' : null,
          copyMessageId: m.copy ? '3000000000000000002' : null,
          attachments: Array.from({ length: m.attachments ?? 0 }, (_, n) => ({ id: `${n + 1}`, filename: `sample-${n + 1}.png`, size: 20_000, spoiler: false })),
          editedAt: m.edited ? new Date(createdAt.getTime() + (m.afterMin + 5) * 60_000) : null,
          deletedAt: m.deleted ? new Date(createdAt.getTime() + (m.afterMin + 5) * 60_000) : null,
        },
      });
    }
    // Sample interviews, written directly: no jobs for the bot, no Discord calls.
    for (const [index, i] of (a.interviews ?? []).entries()) {
      const at = (min: number) => new Date(base.getTime() + min * 60_000);
      const requestedAt = at(i.requestedMin);
      const active = ['AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'BOOKED'].includes(i.status);
      await db.interview.create({
        data: {
          applicationId: app.id, attempt: index + 1, status: i.status, endReason: i.endReason ?? null, activeKey: active ? app.id : null,
          requestedById: officers[0].id, requestedAt,
          windowStart: new Date(requestedAt.getTime() + 2 * 3600_000), windowEnd: new Date(requestedAt.getTime() + 7 * 86_400_000),
          timeZone: i.slotMins ? 'America/New_York' : null, slots: (i.slotMins ?? []).map(at), timesRevision: i.slotMins ? 1 : 0,
          timesSubmittedAt: i.timesUpdatedMin === undefined ? null : at(i.timesUpdatedMin), timesUpdatedAt: i.timesUpdatedMin === undefined ? null : at(i.timesUpdatedMin),
          proposedStart: i.proposed ? at(i.proposed.startMin) : null, proposedById: i.proposed ? officers[i.proposed.by].id : null, proposedAt: i.proposed ? at(i.timesUpdatedMin ?? i.requestedMin) : null,
          bookedStart: i.booked ? at(i.booked.startMin) : null, bookedById: i.booked ? officers[i.booked.by].id : null, bookedAt: i.booked ? at(i.timesUpdatedMin ?? i.requestedMin) : null,
          endedAt: i.ended ? at(i.ended.min) : null, endedById: i.ended?.by == null ? null : officers[i.ended.by].id,
        },
      });
    }
  }

  // Testers answer every raid, after all fake data, without consuming randomness.
  if (testers.length) {
    const seededRaids = await db.raid.findMany({ select: { id: true } });
    for (const tester of testers) {
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({ data: tester, include: { characters: { select: { id: true } } } });
        await tx.signup.createMany({ data: seededRaids.map((raid) => ({ raidId: raid.id, userId: user.id, characterId: user.characters[0]?.id ?? null, response: 'ACCEPT', source: 'WEB' })) });
      });
    }
  }

  const counts = {
    users: await db.user.count(),
    characters: await db.character.count(),
    availability: await db.availability.count(),
    raidTemplates: await db.raidTemplate.count(),
    raids: await db.raid.count(),
    signups: await db.signup.count(),
    classNeeds: await db.classNeed.count(),
    applications: await db.application.count(),
    officerNotes: await db.officerNote.count(),
    interviews: await db.interview.count(),
  };
  console.log('Seeded:', counts);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
