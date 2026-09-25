'use client';

import { useSyncExternalStore } from 'react';
import { detectTimeZone } from '@/lib/time';

/**
 * The viewer's timezone as an external store: detected from the browser, or overridden
 * by the viewer (docs/01 § Time: "let the member override it"). The override lives in
 * localStorage for now; a member's stored override on the user row will feed the same
 * store once auth lands. `null` during server render and hydration, so pages render the
 * realm time first and add the viewer's time after.
 */

export type ViewerTimeZone = { zone: string; source: 'detected' | 'chosen' };

const KEY = 'bureaucracy.viewer-timezone';
const EVENT = 'bureaucracy:viewer-timezone';

function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function readOverride(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && isValidZone(v) ? v : null;
  } catch {
    return null;
  }
}

export function setViewerTimeZone(zone: string | null): void {
  try {
    if (zone && isValidZone(zone)) localStorage.setItem(KEY, zone);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

// useSyncExternalStore needs a stable reference for an unchanged value.
let cached: { key: string; value: ViewerTimeZone } | null = null;

function getSnapshot(): ViewerTimeZone {
  const override = readOverride();
  const zone = override ?? detectTimeZone();
  const source: ViewerTimeZone['source'] = override ? 'chosen' : 'detected';
  const key = `${zone}|${source}`;
  if (!cached || cached.key !== key) cached = { key, value: { zone, source } };
  return cached.value;
}

const getServerSnapshot = () => null;

export function useViewerTimeZone(): ViewerTimeZone | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
