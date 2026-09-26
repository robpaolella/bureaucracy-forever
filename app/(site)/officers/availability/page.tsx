import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OfficerAvailability } from '@/components/heatmap/OfficerAvailability';
import { getRosterAvailability } from '@/lib/roster-availability';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Roster availability — Bureaucracy',
  robots: { index: false, follow: false },
};

/**
 * Officer heatmap (docs/05 § Officer view). The proxy answers 404 to non-officers; this
 * re-checks, then hands the roster count and the not-submitted list to the client, which
 * fetches the stacked grid for its own timezone.
 */
export default async function OfficerAvailabilityPage() {
  const session = await getSession();
  if (session?.role !== 'officer') notFound();

  const roster = await getRosterAvailability();
  const notSubmitted = roster.filter((m) => m.slots === null).map(({ name, wowClass, role }) => ({ name, wowClass, role }));

  return <OfficerAvailability memberCount={roster.length} submitted={roster.length - notSubmitted.length} notSubmitted={notSubmitted} />;
}
