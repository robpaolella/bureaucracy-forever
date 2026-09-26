import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OfficerActions, type MemberOption } from '@/components/raid/OfficerActions';
import { RaidResponseControl } from '@/components/raid/RaidResponse';
import { RaidSummary } from '@/components/raid/RaidSummary';
import { SignupList } from '@/components/raid/SignupList';
import { DualTime } from '@/components/time/DualTime';
import { db } from '@/lib/db';
import type { Role, WowClass } from '@/lib/design/class-colors';
import { countAccepted, groupSignups, isUpcoming, parseRequirements, sourceSplit, type RaidCard, type RaidResponse, type SignupRow } from '@/lib/raids';
import { getSession } from '@/lib/session';
import { BACK_TO_CALENDAR, RAID_EYEBROW } from '@/content/raid';

type Params = { params: Promise<{ raidId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { raidId } = await params;
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { name: true } });
  return { title: `${raid?.name ?? 'Raid'} — Bureaucracy`, robots: { index: false, follow: false } };
}

const MAIN = { where: { isMain: true }, take: 1, select: { name: true, class: true, spec: true, raidRole: true } } as const;

/**
 * Raid detail (docs/04 § Raid detail): sign-ups left, summary right, the viewer's own
 * response in the head. Officers get the actions row and can answer for a member.
 */
export default async function RaidDetailPage({ params }: Params) {
  const session = await getSession();
  if (!session) notFound();
  const { raidId } = await params;

  const [raid, me, members] = await Promise.all([
    db.raid.findUnique({
      where: { id: raidId },
      select: {
        id: true,
        name: true,
        startsAt: true,
        durationMin: true,
        notes: true,
        cancelledAt: true,
        requirements: true,
        signups: {
          select: {
            userId: true,
            response: true,
            source: true,
            reason: true,
            updatedAt: true,
            user: { select: { discordId: true, discordName: true, characters: MAIN } },
            setBy: { select: { discordName: true, characters: { where: { isMain: true }, take: 1, select: { name: true } } } },
          },
        },
      },
    }),
    db.user.findUnique({ where: { discordId: session.discordId }, select: { characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } }),
    session.role === 'officer'
      ? db.user.findMany({ where: { role: { in: ['MEMBER', 'OFFICER'] } }, select: { id: true, discordName: true, characters: { where: { isMain: true }, take: 1, select: { name: true } } }, orderBy: { discordName: 'asc' } })
      : Promise.resolve([]),
  ]);
  if (!raid) notFound();

  const now = new Date();
  const rows: SignupRow[] = raid.signups.map((s) => {
    const main = s.user.characters[0];
    return {
      userId: s.userId,
      name: main?.name ?? s.user.discordName,
      wowClass: (main?.class.toLowerCase() as WowClass | undefined) ?? null,
      spec: main?.spec ?? null,
      role: (main?.raidRole.toLowerCase() as Role | undefined) ?? null,
      response: s.response.toLowerCase() as RaidResponse,
      source: s.source.toLowerCase() as 'web' | 'discord',
      reason: s.reason,
      setBy: s.setBy ? s.setBy.characters[0]?.name ?? s.setBy.discordName : null,
      updatedAt: s.updatedAt.toISOString(),
    };
  });
  const mine = raid.signups.find((s) => s.user.discordId === session.discordId);
  const card: RaidCard = {
    id: raid.id,
    name: raid.name,
    startsAt: raid.startsAt.toISOString(),
    durationMin: raid.durationMin,
    notes: raid.notes,
    cancelled: raid.cancelledAt !== null,
    requirements: parseRequirements(raid.requirements),
    counts: countAccepted(rows),
    mine: (mine?.response.toLowerCase() as RaidResponse | undefined) ?? null,
  };
  const past = !isUpcoming(card, now);
  const memberOptions: MemberOption[] = members
    .map((m) => ({ id: m.id, label: m.characters[0]?.name ?? m.discordName }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col gap-8 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <Link href="/members/calendar" className="inline-flex min-h-11 items-center self-start text-small text-fg-3 underline-offset-4 hover:underline">
            ← {BACK_TO_CALENDAR}
          </Link>
          <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{RAID_EYEBROW}</span>
          <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">
            {raid.name}
            {card.cancelled && <span className="ml-3 align-middle text-base font-normal text-stop">Cancelled</span>}
          </h1>
          <DualTime startsAt={card.startsAt} durationMin={card.durationMin} />
        </div>
        <RaidResponseControl raid={card} viewer={{ role: session.role, raidRole: (me?.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null }} past={past} />
      </section>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:items-start">
        <div className="order-2 flex flex-col gap-6 md:order-1">
          {session.role === 'officer' && <OfficerActions raid={card} members={memberOptions} past={past} />}
          <SignupList sections={groupSignups(rows)} now={now.toISOString()} />
        </div>
        <div className="order-1 md:order-2">
          <RaidSummary counts={card.counts} requirements={card.requirements} split={sourceSplit(rows)} notes={raid.notes} cancelled={card.cancelled} />
        </div>
      </div>
    </div>
  );
}
