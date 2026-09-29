/** Copy for the class-needs editor (docs/04 § Recruitment: the table is the single source of truth). */

export const NEEDS_EDITOR_HEAD = {
  eyebrow: 'Officers',
  title: 'Edit class needs',
  lede: 'Set a status per spec. The recruitment page, the home teaser and the bot’s /recruiting reply update within a minute. Star one high-need spec to lead the home page.',
};

export const NEEDS_EDITOR = {
  statusFor: (wowClass: string, spec: string) => `Need for ${wowClass} ${spec}`,
  saved: (wowClass: string, spec: string, status: string) => `${wowClass} ${spec}: ${status}`,
  featureLabel: (who: string) => `Feature ${who} first on the home page`,
  featureOnlyHigh: 'Only a high-need spec can be featured',
  featured: (who: string) => `${who} leads the home page`,
  unfeatured: (who: string) => `${who} no longer featured`,
};
