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
import { buildApplications, buildClassNeeds, buildRaids, buildRaidTemplates, buildRoster, paintWeek, rng } from './seed-data';

loadEnv({ path: '.env.local' });
loadEnv();

const CLASS = {
  warrior: 'WARRIOR', paladin: 'PALADIN', hunter: 'HUNTER', rogue: 'ROGUE', priest: 'PRIEST',
  shaman: 'SHAMAN', mage: 'MAGE', warlock: 'WARLOCK', druid: 'DRUID',
} as const;
const RAID_ROLE = { tank: 'TANK', healer: 'HEALER', melee: 'MELEE', ranged: 'RANGED' } as const;

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be set');
  const target = assertWriteTarget(connectionString);
  console.log(`Seeding the ${target} database.`);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const now = new Date();
  const random = rng(20261104);

  // Wipe in dependency order.
  await db.botRequest.deleteMany();
  await db.outboxJob.deleteMany();
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
  const roster = buildRoster();
  const users: Array<{ id: string; role: string; raidRole: string; timezone: string; name: string }> = [];
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
    });
    users.push({ id: user.id, role: m.role, raidRole: m.raidRole, timezone: m.timezone, name: m.name });
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
        data: { applicationId: app.id, authorId: officers[2].id, body: 'Logs look clean. Deaths avoided more than damage done.', createdAt: new Date(createdAt.getTime() + 2 * 3600_000) },
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
  };
  console.log('Seeded:', counts);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
