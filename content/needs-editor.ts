/** Copy for the class-needs editor (docs/04 § Recruitment: the table is the single source of truth). */

export const NEEDS_EDITOR_HEAD = {
  eyebrow: 'Officers',
  title: 'Edit class needs',
  lede: 'Set a status per spec here, or with /recruitment in Discord. The recruitment page and the home teaser update within a minute.',
};

export const NEEDS_EDITOR = {
  statusFor: (wowClass: string, spec: string) => `Need for ${wowClass} ${spec}`,
  saved: (wowClass: string, spec: string, status: string) => `${wowClass} ${spec}: ${status}`,
};
