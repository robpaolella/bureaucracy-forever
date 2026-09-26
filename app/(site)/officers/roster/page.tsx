import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RosterEditor, type EditorMember } from '@/components/roster/RosterEditor';
import type { Rank } from '@/components/ui/Badges';
import { db } from '@/lib/db';
import type { Role, WowClass } from '@/lib/design/class-colors';
import { getSession } from '@/lib/session';
import { ROSTER_EDITOR_HEAD } from '@/content/roster-editor';

export const metadata: Metadata = {
  title: 'Edit the roster — Bureaucracy',
  robots: { index: false, follow: false },
};

/**
 * The officer roster editor: every Discord member or officer with their main. The proxy
 * already 404s non-officers on /officers; the check here guards direct renders.
 */
export default async function RosterEditorPage() {
  const session = await getSession();
  if (!session || session.role !== 'officer') notFound();

  const users = await db.user.findMany({
    where: { role: { in: ['MEMBER', 'OFFICER'] } },
    select: { id: true, discordName: true, role: true, characters: { where: { isMain: true }, take: 1, select: { id: true, name: true, class: true, spec: true, raidRole: true, rank: true } } },
    orderBy: { discordName: 'asc' },
  });
  const members: EditorMember[] = users
    .map((u) => {
      const c = u.characters[0];
      return {
        userId: u.id,
        discordName: u.discordName,
        officer: u.role === 'OFFICER',
        main: c ? { id: c.id, name: c.name, wowClass: c.class.toLowerCase() as WowClass, spec: c.spec, role: c.raidRole.toLowerCase() as Role, rank: c.rank.toLowerCase() as Rank } : null,
      };
    })
    .sort((a, b) => (a.main?.name ?? a.discordName).localeCompare(b.main?.name ?? b.discordName));

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{ROSTER_EDITOR_HEAD.eyebrow}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{ROSTER_EDITOR_HEAD.title}</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{ROSTER_EDITOR_HEAD.lede}</p>
      </section>
      <RosterEditor members={members} />
    </div>
  );
}
