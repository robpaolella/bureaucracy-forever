import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarList } from '@/components/calendar/CalendarList';
import { db } from '@/lib/db';
import type { Role } from '@/lib/design/class-colors';
import { loadRaidCards } from '@/lib/raid-cards';
import { emptyRaidInput, pastWindowStart } from '@/lib/raids';
import type { Weekday } from '@/lib/time';
import { getSession } from '@/lib/session';
import { CALENDAR_HEAD } from '@/content/calendar';

export const metadata: Metadata = {
  title: 'Raid calendar',
  robots: { index: false, follow: false },
};

/**
 * The raid calendar (docs/04 § Raid calendar). Socials may read it; members answer.
 * Sign-ups are loaded with each user's main so the role stacks count accepted answers
 * per role; the viewer's own answer rides on the card.
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * `?new=1` opens the schedule form (the heatmap's window finder links here); `day` (0 = Sunday), `time`
 * (HH:MM guild) and `length` (minutes) prefill it from a heatmap window.
 */
function scheduleFrom(params: Record<string, string | string[] | undefined>) {
  const day = Number(one(params.day));
  const length = Number(one(params.length));
  return {
    openOnLoad: one(params.new) === '1',
    initial: emptyRaidInput({
      weekday: Number.isInteger(day) && day >= 0 && day <= 6 ? (day as Weekday) : undefined,
      time: one(params.time),
      length: Number.isFinite(length) ? length : undefined,
    }),
  };
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) notFound();
  const params = await searchParams;

  const [cards, me] = await Promise.all([
    loadRaidCards(pastWindowStart(), session.discordId),
    db.user.findUnique({ where: { discordId: session.discordId }, select: { characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } }),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{CALENDAR_HEAD.eyebrow}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{CALENDAR_HEAD.title}</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{CALENDAR_HEAD.lede}</p>
      </section>
      <CalendarList
        raids={cards}
        viewer={{ role: session.role, raidRole: (me?.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null, availabilitySubmitted: session.availabilitySubmitted }}
        schedule={session.role === 'officer' ? scheduleFrom(params) : undefined}
      />
    </div>
  );
}
