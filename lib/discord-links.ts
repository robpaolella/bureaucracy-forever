/** Deep links into the guild's Discord. The guild id is the one the login reads roles from. */
export function discordThreadUrl(threadId: string | null | undefined, guildId: string | undefined = process.env.DISCORD_GUILD_ID): string | null {
  if (!threadId || !guildId) return null;
  return `https://discord.com/channels/${guildId}/${threadId}`;
}
