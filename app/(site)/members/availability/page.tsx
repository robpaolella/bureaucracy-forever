import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AvailabilityEditor, type StoredAvailability } from '@/components/availability/AvailabilityEditor';
import { normalizeWeek } from '@/lib/availability';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'My availability — Bureaucracy',
  robots: { index: false, follow: false },
};

/**
 * Member availability (docs/05 § Member view). The proxy gates the route; this re-checks
 * and loads the member's painted week for the editor.
 */
export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session || session.role === 'social') notFound();

  const row = await db.availability.findFirst({ where: { user: { discordId: session.discordId } } });
  const initial: StoredAvailability | null = row
    ? { timezone: row.timezone, slots: normalizeWeek(row.slots), updatedAt: row.updatedAt.toISOString() }
    : null;

  return <AvailabilityEditor initial={initial} />;
}
