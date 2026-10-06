import { isEligible, reservesLockAt } from '@/lib/loot-rules';
import type { RaidResponse } from '@/lib/raids';

export type ReminderRaid = {
  status: string;
  startsAt: Date;
  postedAt: Date | null;
  remindReservesAt: Date | null;
};

/** The two hours before the reserve lock, independent of the sign-up lock. */
export function reserveReminderDue(raid: ReminderRaid, now: Date, enabled: boolean, hasLootTable: boolean): boolean {
  const lock = reservesLockAt(raid.startsAt).getTime();
  return enabled && hasLootTable && (raid.status === 'SCHEDULED' || raid.status === 'LOCKED')
    && raid.postedAt !== null && raid.remindReservesAt === null
    && now.getTime() >= lock - 120 * 60_000 && now.getTime() < lock;
}

export type ReminderSignup = {
  userId: string;
  response: 'ACCEPT' | 'TENTATIVE' | 'ABSENT' | null;
  user: { discordId: string; characters: readonly { id: string }[] };
};

/** Reserves belong to their holder, regardless of who entered them; standing is irrelevant. */
export function reserveReminderRecipients(signups: readonly ReminderSignup[], reserves: readonly { userId: string; kind: 'HR' | 'SR' }[]): string[] {
  const kinds = new Map<string, Set<string>>();
  for (const reserve of reserves) {
    if (!kinds.has(reserve.userId)) kinds.set(reserve.userId, new Set());
    kinds.get(reserve.userId)!.add(reserve.kind);
  }
  return signups.filter((s) => isEligible(s.response?.toLowerCase() as RaidResponse | undefined)
    && s.user.characters.length > 0 && !(kinds.get(s.userId)?.has('HR') && kinds.get(s.userId)?.has('SR')))
    .map((s) => s.user.discordId);
}
