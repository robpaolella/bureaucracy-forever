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
  title: 'Roster — Bureaucracy',
  robots: { index: false, follow: false },
};

/**
 * The guild roster (docs/04 § Roster): every main character with class, spec, role,
 * rank, attendance and join date. Socials may read it (docs/03 § Roles); the proxy sends
 * the logged-out to Discord. Officer editing arrives with the roster editor.
 */
export default async function RosterPage() {
  const session = await getSession();
  if (!session) notFound();

  const mains = await db.character.findMany({
    where: { isMain: true },
    select: { id: true, name: true, class: true, spec: true, raidRole: true, rank: true, attendance: true, joinedAt: true },
    orderBy: { name: 'asc' },
  });
  const rows: RosterRow[] = mains.map((c) => ({
    id: c.id,
    name: c.name,
    wowClass: c.class.toLowerCase() as WowClass,
    spec: c.spec,
    role: c.raidRole.toLowerCase() as Role,
    rank: c.rank.toLowerCase() as Rank,
    attendance: c.attendance,
    joinedAt: c.joinedAt.toISOString(),
  }));

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
