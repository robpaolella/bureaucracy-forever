import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/session';

declare module 'next-auth' {
  interface Session {
    user: {
      /** Discord user id. */
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }
}

// The JWT carries discordId, role and rolesCheckedAt; auth.ts reads them defensively
// through its own guards rather than relying on a module augmentation.
