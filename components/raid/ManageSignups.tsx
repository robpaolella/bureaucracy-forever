'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Manage = { on: boolean; setOn: (next: boolean) => void };

/** Outside a provider (a member's page, a test) the switch is off and nothing can turn it on. */
const ManageContext = createContext<Manage>({ on: false, setOn: () => {} });

/**
 * The "Manage sign-ups" switch's state, shared by the officer actions, the roster, the lists and the
 * bench. React state only: off on every visit, nothing stored or put in the URL.
 */
export function ManageSignupsProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  const value = useMemo(() => ({ on, setOn }), [on]);
  return <ManageContext.Provider value={value}>{children}</ManageContext.Provider>;
}

export function useManageSignups(): Manage {
  return useContext(ManageContext);
}

/** Shows `managing` while the switch is on and `viewing` while it is off, so server components can choose without being client ones. */
export function ManageGate({ managing, viewing }: { managing: ReactNode; viewing: ReactNode }) {
  return <>{useManageSignups().on ? managing : viewing}</>;
}
