import 'server-only';

import { db } from '@/lib/db';
import type { Session } from '@/lib/session';

/**
 * The User row for the current session, created on first write. JWT sessions do not
 * create one on login; the first thing a member or officer writes does (the same rule
 * the availability and sign-up routes follow inline).
 */
export async function ensureUser(session: Session): Promise<{ id: string }> {
  const role = session.role.toUpperCase() as 'SOCIAL' | 'MEMBER' | 'OFFICER';
  return db.user.upsert({
    where: { discordId: session.discordId },
    create: { discordId: session.discordId, discordName: session.name, role },
    update: { discordName: session.name, role },
    select: { id: true },
  });
}
