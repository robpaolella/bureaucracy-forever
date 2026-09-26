'use client';

import { useSyncExternalStore } from 'react';

export type Density = 'comfortable' | 'compact';

const KEY = 'bureaucracy.roster-density';
const EVENT = 'bureaucracy:roster-density';

function read(): Density {
  try {
    return localStorage.getItem(KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

export function setDensity(next: Density): void {
  try {
    localStorage.setItem(KEY, next);
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

/** The roster's row density, persisted in this browser (docs/04 § Roster § Density). Comfortable on the server. */
export function useDensity(): Density {
  return useSyncExternalStore(subscribe, read, () => 'comfortable');
}
