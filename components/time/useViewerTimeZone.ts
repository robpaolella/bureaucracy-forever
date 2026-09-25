'use client';

import { useSyncExternalStore } from 'react';
import { detectTimeZone } from '@/lib/time';

const subscribe = () => () => {};
const serverSnapshot = () => null;

/**
 * The viewer's IANA zone, known only in the browser. `null` during server render and
 * hydration, so callers render the realm time first and add the local time after.
 * A member's stored override (docs/01 § Time) will be threaded through here later.
 */
export function useViewerTimeZone(): string | null {
  return useSyncExternalStore(subscribe, detectTimeZone, serverSnapshot);
}
