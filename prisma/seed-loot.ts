import type { PrismaClient } from '@/lib/generated/prisma/client';

/** Local-only fixtures: no Wowhead import, real accounts or staging data. */
export async function seedLocalLoot(db: PrismaClient, now: Date) {
  const member = await db.user.findFirstOrThrow({ where: { discordName: 'redtape' }, include: { characters: true } });
  const officer = await db.user.findFirstOrThrow({ where: { discordName: 'ledgerline' }, include: { characters: true } });
  const template = await db.raidTemplate.create({ data: { name: 'Sample reserve table', short: 'Sample', size: 40, durationMin: 180, requirements: { tank: 3, healer: 10, melee: 12, ranged: 15 } } });
  const names = ['Archive Blade', 'Ashen Band', 'Binder of Shared Secrets', 'Dusty Signet', ...Array.from({ length: 156 }, (_, i) => `Sample Relic ${String(i + 1).padStart(3, '0')}`)];
  for (const [i, name] of names.entries()) {
    const item = { name, quality: i === 3 ? 3 : 4, icon: i === 0 ? 'inv_sword_04' : 'inv_jewelry_ring_01', tooltipHtml: `<table><tr><td><b>${name}</b><br>Local sample item</td></tr></table>` };
    await db.lootItem.upsert({ where: { id: 9000001 + i }, create: { id: 9000001 + i, source: 'CLASSIC', fetchedAt: now, ...item }, update: item });
  }
  for (const [position, name, ids, isTrash] of [
    [0, 'The Archivist', [9000001, 9000002, 9000003, ...names.slice(4).map((_, i) => 9000005 + i)], false],
    [1, 'The Auditor', [9000003], false],
    [2, 'Hallway drops', [9000004], true],
  ] as const) {
    await db.lootBoss.create({ data: { templateId: template.id, name, position, isTrash, entries: { create: ids.map((itemId, index) => ({ itemId, position: index })) } } });
  }
  for (const state of ['Open', 'Locked', 'Cancelled', 'Not eligible']) {
    const startsAt = new Date(now.getTime() + (state === 'Locked' ? 10 * 60_000 : 7 * 86_400_000));
    const raid = await db.raid.create({ data: {
      name: `Sample reserves — ${state}`, templateId: template.id, startsAt, durationMin: 180,
      locksAt: new Date(now.getTime() + (state === 'Locked' ? -60_000 : 6 * 86_400_000)),
      cancelledAt: state === 'Cancelled' ? now : null,
      requirements: { tank: 3, healer: 10, melee: 12, ranged: 15 },
    } });
    for (const user of [member, officer]) {
      const character = user.characters[0];
      await db.signup.create({ data: { raidId: raid.id, userId: user.id, response: state === 'Not eligible' && user.id === member.id ? 'ABSENT' : 'ACCEPT', source: 'WEB' } });
      await db.reserve.create({ data: { raidId: raid.id, userId: user.id, characterId: character.id, itemId: user.id === member.id ? 9000002 : 9000003, kind: 'SR' } });
    }
    if (state === 'Locked') {
      await db.lootAward.create({ data: { raidId: raid.id, itemId: 9000001, characterId: member.characters[0].id, characterName: member.characters[0].name, userId: member.id, method: 'HR', recordedById: officer.id } });
    }
  }
}
