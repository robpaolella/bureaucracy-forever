import NextAuth from 'next-auth';
import Discord, { type DiscordProfile } from 'next-auth/providers/discord';
import { lookupGuildMember } from '@/lib/auth/discord';
import { roleIdsFromEnv } from '@/lib/auth/roles';
import { asRole, claimsForSignIn, refreshClaims } from '@/lib/auth/token-roles';

/**
 * Auth.js with the Discord provider. Sessions are JWTs (no database yet). Site access is
 * derived from the member's guild roles at sign-in and re-read once an hour, so a removed
 * Discord role demotes within the hour and never survives a fresh sign-in (docs/03). A
 * Discord outage keeps an established role for at most a day; leaving the guild demotes
 * at the next re-read.
 *
 * Role derivation is lib/auth/roles.ts and nothing else: the Officer role id grants
 * officer, the Guild Member role id grants member, everyone else is social. Discord
 * Administrator and permission bits grant nothing, deliberately. The claim logic lives in
 * lib/auth/token-roles.ts so it is unit-tested; this file only wires it to Auth.js.
 */

const lookup = (discordId: string) => lookupGuildMember(discordId);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js refuses every request unless the host is trusted; setting AUTH_URL alone does
  // not lift that. Development trusts any host so `npm run dev` works on any port. In
  // production the host is trusted when AUTH_URL pins the callback URL or when Vercel is
  // the host, since Vercel only routes the project's own domains to this function. With
  // neither set, production still fails fast rather than trusting an arbitrary header.
  trustHost: process.env.NODE_ENV !== 'production' || Boolean(process.env.AUTH_URL || process.env.VERCEL),
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
        const claims = await claimsForSignIn(String(discord.id), discord, roleIdsFromEnv(), lookup);
        return { ...token, ...claims };
      }
      const refreshed = await refreshClaims(token, roleIdsFromEnv(), lookup);
      return { ...token, ...refreshed };
    },
    session({ session, token }) {
      session.user.id = typeof token.discordId === 'string' ? token.discordId : '';
      session.user.role = asRole(token.role);
      return session;
    },
  },
});
