/** Copy for the class-needs editor (docs/04 § Recruitment: the table is the single source of truth). */

export const NEEDS_EDITOR_HEAD = {
  eyebrow: 'Officers',
  title: 'Edit class needs',
  lede: 'Set a status per spec. The recruitment page, the home teaser and the bot’s /recruiting reply update within a minute.',
};

export const NEEDS_EDITOR = {
  spec: 'Spec',
  roles: 'Role',
  status: 'Status',
  statusFor: (wowClass: string, spec: string) => `Need for ${wowClass} ${spec}`,
  saved: (wowClass: string, spec: string, status: string) => `${wowClass} ${spec}: ${status}`,
};
