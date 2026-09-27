import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RosterTable } from '@/components/roster/RosterTable';
import type { Rank } from '@/components/ui/Badges';
import { db } from '@/lib/db';
import type { Role, WowClass } from '@/lib/design/class-colors';
import type { RosterRow } from '@/lib/roster';
import { getSession } from '@/lib/session';
import { ROSTER_HEAD } from '@/content/roster';

export const metadata: Metadata = {
  title: 'Roster',
  robots: { index: false, follow: false },
};

/**
 * The guild roster (docs/04 § Roster): everyone holding Guild Member or Officer in Discord,
 * with their main's class, spec and role once officers add one, their rank, attendance and
 * join date. Socials may read it (docs/03 § Roles); the proxy sends the logged-out to Discord.
 */
export default async function RosterPage() {
  const session = await getSession();
  if (!session) notFound();

  const users = await db.user.findMany({
    where: { inGuild: true, role: { in: ['MEMBER', 'OFFICER'] } },
    select: { id: true, discordName: true, rank: true, createdAt: true, characters: { where: { isMain: true }, take: 1, select: { name: true, class: true, spec: true, raidRole: true, attendance: true, joinedAt: true } } },
    orderBy: { discordName: 'asc' },
  });
  const rows: RosterRow[] = users.map((u) => {
    const c = u.characters[0];
    return {
      id: u.id,
      name: c?.name ?? u.discordName,
      wowClass: (c?.class.toLowerCase() as WowClass | undefined) ?? null,
      spec: c?.spec ?? null,
      role: (c?.raidRole.toLowerCase() as Role | undefined) ?? null,
      rank: u.rank.toLowerCase() as Rank,
      attendance: c?.attendance ?? null,
      joinedAt: (c?.joinedAt ?? u.createdAt).toISOString(),
    };
  });

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{ROSTER_HEAD.eyebrow}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{ROSTER_HEAD.title}</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{ROSTER_HEAD.lede}</p>
      </section>
      <RosterTable rows={rows} />
    </div>
  );
}
