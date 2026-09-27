/** Direct messages the bot sends applicants after a decision (SYNC-SPEC §5 application.decide). The site fills them and puts the text in the job payload. */

export const DM_TEMPLATES = {
  accepted: (character: string) =>
    `Your application to Bureaucracy for ${character} was accepted. An officer will reach out here on Discord for a short chat, then it's a two-week trial with full loot rights. You now have the Guild Member role; the raid calendar and roster are on https://www.bureauguild.com. Welcome aboard.`,
  declined: (character: string) =>
    `Thanks for applying to Bureaucracy with ${character}. We're not able to take you on right now. You're welcome to stay in the Discord and apply again later; officers will say if anything changes.`,
};

export function decisionDm(status: 'accepted' | 'declined', character: string): string {
  return DM_TEMPLATES[status](character);
}
