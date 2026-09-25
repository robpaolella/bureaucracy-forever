'use server';

import { signOut } from '@/auth';

/** Log out and return to the home page. Used by the avatar menu and the mobile drawer. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
