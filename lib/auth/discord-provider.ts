import Discord from 'next-auth/providers/discord';

export const DISCORD_ISSUER = 'https://discord.com';

export const discordProvider = () =>
  Discord({
    // Discord returns an `iss` parameter on the redirect (RFC 9207). Auth.js checks it
    // against the provider's issuer and falls back to the placeholder https://authjs.dev,
    // which rejects every sign-in, so set it explicitly.
    issuer: DISCORD_ISSUER,
    // `identify` only: roles are read server-side with the bot token, not the user's.
    authorization: { params: { scope: 'identify' } },
  });
