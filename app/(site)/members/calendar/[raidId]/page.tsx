import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LootLog } from '@/components/loot/LootLog';
import { RaidLoot } from '@/components/loot/RaidLoot';
import { Reserves } from '@/components/loot/Reserves';
import { AttendanceForm } from '@/components/raid/AttendanceForm';
import { BenchCard } from '@/components/raid/BenchCard';
import { OfficerActions, type MemberOption } from '@/components/raid/OfficerActions';
import { RaidResponseControl } from '@/components/raid/RaidResponse';
import { RaidSummary } from '@/components/raid/RaidSummary';
import { RosterByRole } from '@/components/raid/RosterByRole';
import { UnansweredCard } from '@/components/raid/UnansweredCard';
import { DualTime } from '@/components/time/DualTime';
import { ToastHost } from '@/components/ui';
import { db } from '@/lib/db';
import type { Role, WowClass } from '@/lib/design/class-colors';
import { discordThreadUrl } from '@/lib/discord-links';
import { lootEnabled } from '@/lib/flags';
import { loadActiveReserves, loadAwards, loadLootLogContext, loadLootTable, loadMemberRaidLoot, loadReserveTargets } from '@/lib/loot-data';
import { reservesLockAt, reservesLocked } from '@/lib/loot-rules';
import { splitStanding, type DetailRow } from '@/lib/raid-detail';
import { countAccepted, isUpcoming, parseRequirements, sourceSplit, type RaidCard, type RaidResponse } from '@/lib/raids';
import { getSession } from '@/lib/session';
import { BACK_TO_CALENDAR, RAID_EYEBROW, SUMMARY } from '@/content/raid';
import { RESERVES } from '@/content/reserves';

type Params = { params: Promise<{ raidId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { raidId } = await params;
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { name: true } });
  return { title: raid?.name ?? 'Raid', robots: { index: false, follow: false } };
}

const MAIN = { where: { isMain: true }, take: 1, select: { name: true, class: true, spec: true, raidRole: true } } as const;

/**
 * Raid detail (docs/04 § Raid detail, SYNC-SPEC §9.5): the viewer's own response in the
 * head, the roster grouped by role with Answer and Via columns, the bench, who has not
 * answered, and the composition card. Officers get the actions row, "Answer for them" on
 * every row, "Nudge in Discord", "Move to roster" and, after the night, attendance.
 */
export default async function RaidDetailPage({ params }: Params) {
  const session = await getSession();
  if (!session) notFound();
  const { raidId } = await params;
  const officer = session.role === 'officer';

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
        cancelReason: true,
        requirements: true,
        status: true,
        locksAt: true,
        discordThreadId: true,
        seriesId: true,
        templateId: true,
        template: { select: { short: true } },
        signups: {
          select: {
            userId: true,
            response: true,
            standing: true,
            attended: true,
            source: true,
            reason: true,
            updatedAt: true,
            user: { select: { discordId: true, discordName: true, characters: MAIN } },
            setBy: { select: { discordName: true } },
          },
        },
      },
    }),
    db.user.findUnique({ where: { discordId: session.discordId }, select: { characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } }),
    officer
      ? db.user.findMany({ where: { role: { in: ['MEMBER', 'OFFICER'] } }, select: { id: true, discordName: true }, orderBy: { discordName: 'asc' } })
      : Promise.resolve([]),
  ]);
  if (!raid) notFound();

  const now = new Date();
  const rows: DetailRow[] = raid.signups.map((s) => {
    const main = s.user.characters[0];
    return {
      userId: s.userId,
      name: s.user.discordName,
      character: main?.name ?? null,
      wowClass: (main?.class.toLowerCase() as WowClass | undefined) ?? null,
      spec: main?.spec ?? null,
      role: (main?.raidRole.toLowerCase() as Role | undefined) ?? null,
      standing: s.standing,
      response: (s.response?.toLowerCase() as RaidResponse | undefined) ?? null,
      attended: s.attended,
      source: s.source.toLowerCase() as 'web' | 'discord',
      reason: s.reason,
      setBy: s.setBy?.discordName ?? null,
      updatedAt: s.updatedAt.toISOString(),
    };
  });
  const { roster, bench, unanswered } = splitStanding(rows);
  const mine = raid.signups.find((s) => s.user.discordId === session.discordId);
  const card: RaidCard = {
    id: raid.id,
    name: raid.name,
    startsAt: raid.startsAt.toISOString(),
    durationMin: raid.durationMin,
    notes: raid.notes,
    cancelled: raid.cancelledAt !== null,
    requirements: parseRequirements(raid.requirements),
    // Composition counts roster acceptances only (SYNC-SPEC §7).
    counts: countAccepted(roster),
    mine: (mine?.response?.toLowerCase() as RaidResponse | undefined) ?? null,
    status: raid.status,
    locksAt: raid.locksAt.toISOString(),
    short: raid.template?.short ?? null,
    onRoster: mine?.standing === 'ROSTER',
  };
  const past = !isUpcoming(card, now);
  const open = !past && !card.cancelled && raid.status === 'SCHEDULED';
  const listed = new Set(rows.map((r) => r.userId));
  const memberOptions: MemberOption[] = members
    .filter((m) => !listed.has(m.id))
    .map((m) => ({ id: m.id, label: m.discordName }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const answered = rows.filter((r) => r.response !== null);

  const memberLoot = await loadMemberRaidLoot(raid.id);

  // Loot reserves: behind LOOT_ENABLED, for members and officers, on raids whose tier has a table.
  const showLoot = lootEnabled() && session.role !== 'social' && raid.templateId !== null;
  const [table, reserves, reserveTargets, awards, logContext] = showLoot
    ? await Promise.all([
        loadLootTable(raid.templateId!),
        loadActiveReserves(raid.id),
        loadReserveTargets(raid.id, session.discordId, officer),
        officer ? loadAwards(raid.id) : Promise.resolve([]),
        officer ? loadLootLogContext(raid.id) : Promise.resolve(null),
      ])
    : [null, [], null, [], null];

  return (
    <ToastHost>
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
            {table && reserveTargets && (
              <a href="#loot-reserves" className="inline-flex min-h-11 items-center self-start text-small text-teal underline underline-offset-4">
                {RESERVES.heading}
              </a>
            )}
            {memberLoot && (
              <a href="#raid-loot" className="inline-flex min-h-11 items-center self-start text-small text-teal underline underline-offset-4">Loot</a>
            )}
            {card.cancelled && raid.cancelReason && (
              <p className="text-sm text-fg-2">
                <span className="text-fg-3">{SUMMARY.cancelReason}</span> {raid.cancelReason}
              </p>
            )}
          </div>
          <RaidResponseControl raid={card} viewer={{ role: session.role, raidRole: (me?.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null }} past={past} now={now.toISOString()} />
        </section>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:items-start">
          <div className="order-2 flex flex-col gap-6 md:order-1">
            {officer && <OfficerActions raid={card} members={memberOptions} past={past} threadUrl={discordThreadUrl(raid.discordThreadId)} fromSeries={raid.seriesId !== null} />}
            {officer && past && !card.cancelled && <AttendanceForm raidId={raid.id} rows={rows} />}
            <RosterByRole raidId={raid.id} rows={roster} now={now.toISOString()} canAnswerFor={officer && !past && !card.cancelled} showAttendance={past} />
          </div>
          <div className="order-1 flex flex-col gap-6 md:order-2">
            <RaidSummary counts={card.counts} requirements={card.requirements} split={sourceSplit(answered)} notes={raid.notes} cancelled={card.cancelled} status={raid.status} locksAt={raid.locksAt.toISOString()} />
            <UnansweredCard raidId={raid.id} rows={unanswered} officer={officer} posted={raid.discordThreadId !== null} open={open} />
            <BenchCard raidId={raid.id} rows={bench} officer={officer && !past && !card.cancelled} />
          </div>
        </div>

        {table && reserveTargets && (
          <Reserves
            raidId={raid.id}
            table={table}
            reserves={reserves}
            lockAt={reservesLockAt(raid.startsAt).toISOString()}
            locked={reservesLocked(raid.startsAt, now)}
            cancelled={card.cancelled}
            officer={officer}
            targets={reserveTargets.targets}
            reason={reserveTargets.reason ? RESERVES[reserveTargets.reason] : null}
          />
        )}
        {memberLoot && <RaidLoot raidId={raid.id} initial={memberLoot} />}
        {table && logContext && !card.cancelled && (
          <LootLog raidId={raid.id} table={table} reserves={reserves} candidates={logContext.candidates} raidAwards={logContext.raidAwards} hrAwards={logContext.hrAwards} awards={awards} />
        )}
      </div>
    </ToastHost>
  );
}
