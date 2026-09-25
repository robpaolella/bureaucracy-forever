import NextAuth from 'next-auth';
import Discord, { type DiscordProfile } from 'next-auth/providers/discord';
import { displayName, fetchGuildMember } from '@/lib/auth/discord';
import { roleFromDiscordRoles, roleIdsFromEnv } from '@/lib/auth/roles';
import type { Role } from '@/lib/session';

/**
 * Auth.js with the Discord provider. Sessions are JWTs (no database yet). Site access is
 * derived from the member's guild roles at sign-in and re-read once an hour, so a removed
 * Discord role demotes within the hour and never survives a fresh sign-in (docs/03).
 *
 * Role derivation is lib/auth/roles.ts and nothing else: the Officer role id grants
 * officer, the Guild Member role id grants member, everyone else is social. Discord
 * Administrator and permission bits grant nothing, deliberately.
 */

const ROLE_TTL_MS = 60 * 60 * 1000;

const ROLES: readonly Role[] = ['social', 'member', 'officer'];
const asRole = (value: unknown): Role => (ROLES.includes(value as Role) ? (value as Role) : 'social');
const asNumber = (value: unknown): number => (typeof value === 'number' ? value : 0);

async function roleFor(discordId: string) {
  const member = await fetchGuildMember(discordId);
  return { member, role: roleFromDiscordRoles(member?.roles ?? [], roleIdsFromEnv()) };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Discord({
      // `identify` only: roles are read server-side with the bot token, not the user's.
      authorization: { params: { scope: 'identify' } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discord = profile as unknown as DiscordProfile;
        const discordId = String(discord.id);
        const { member, role } = await roleFor(discordId);
        token.discordId = discordId;
        token.role = role;
        token.name = displayName(member, discord);
        token.rolesCheckedAt = Date.now();
        return token;
      }
      if (typeof token.discordId === 'string' && Date.now() - asNumber(token.rolesCheckedAt) > ROLE_TTL_MS) {
        const { role } = await roleFor(token.discordId);
        token.role = role;
        token.rolesCheckedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = typeof token.discordId === 'string' ? token.discordId : '';
      session.user.role = asRole(token.role);
      return session;
    },
  },
});
