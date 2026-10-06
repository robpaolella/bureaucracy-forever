import { WEEKDAY_NAMES, zonedParts, type Weekday } from '@/lib/time';

/**
 * The guild weekday printed before the lockout-reset time ("Tuesday "), or nothing when the
 * reset falls on another day for the viewer: LocalTime then names the viewer's day itself.
 */
export function resetDayLabel(day: Weekday, resetAt: Date, viewerZone: string | null): string {
  return viewerZone && zonedParts(resetAt, viewerZone).weekday !== day ? '' : `${WEEKDAY_NAMES[day]} `;
}
