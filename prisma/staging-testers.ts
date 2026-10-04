type RosterIdentity = { discordId: string; name: string };

/** Validate before any seed deletes; never consume the fake roster's random stream. */
export function parseStagingTesters(value: string | undefined, roster: readonly RosterIdentity[]) {
  const ids = new Set<string>();
  const seededIds = new Set(roster.map((member) => member.discordId));
  const names = new Set(roster.map((member) => member.name.toLowerCase()));
  if (!value?.trim()) return [];

  return value.split(',').map((entry, index) => {
    const parts = entry.trim().split(':').map((part) => part.trim());
    const [discordId, role] = parts;
    const fail = (reason: string): never => {
      throw new Error(`STAGING_TESTERS entry ${index + 1}: ${reason}.`);
    };
    if (parts.length !== 2) fail('use discordId:role');
    if (!/^\d+$/.test(discordId)) fail('Discord id must contain digits only');
    if (role !== 'officer' && role !== 'member') fail('role must be officer or member');
    if (ids.has(discordId)) fail('duplicate Discord id');
    if (seededIds.has(discordId)) fail('Discord id belongs to a seeded member');
    ids.add(discordId);

    const officer = role === 'officer';
    const base = officer ? 'Testofficer' : 'Testraider';
    let name = base;
    let suffix = 2;
    while (names.has(name.toLowerCase())) name = `${base}${suffix++}`;
    names.add(name.toLowerCase());
    return {
      discordId,
      discordName: name.toLowerCase(),
      role: officer ? 'OFFICER' as const : 'MEMBER' as const,
      rank: officer ? 'OFFICER' as const : 'RAIDER' as const,
      inGuild: true,
      characters: {
        create: {
          name,
          class: officer ? 'WARRIOR' as const : 'MAGE' as const,
          spec: officer ? 'Protection' : 'Frost',
          raidRole: officer ? 'TANK' as const : 'RANGED' as const,
          rank: officer ? 'OFFICER' as const : 'RAIDER' as const,
          isMain: true,
        },
      },
    };
  });
}
