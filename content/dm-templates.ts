/** Direct messages the bot sends applicants after a decision (SYNC-SPEC §4 Decision request, §5 application.decide). The site fills them and puts the text in the job payload. */

export const DM_TEMPLATES = {
  raider: (character: string) =>
    `Your application to Bureaucracy for ${character} was accepted. Your two-week trial starts today. You now have the Guild Member role; the raid calendar and roster are on https://www.bureauguild.com. Welcome aboard.`,
  social: (character: string) =>
    `Your application to Bureaucracy for ${character} was accepted as a social member. You now have the Guild Member role. Welcome aboard.`,
  declined: (character: string) =>
    `Thanks for applying to Bureaucracy with ${character}. We're not able to take you on right now. You're welcome to stay in the Discord and apply again later; officers will say if anything changes.`,
};

/** The standard message for a decision: an accept by the path it ends on, or a decline. */
export function decisionDm(kind: keyof typeof DM_TEMPLATES, character: string): string {
  return DM_TEMPLATES[kind](character);
}
