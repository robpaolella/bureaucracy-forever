/** Copy for the officer roster editor (roadmap Phase 4; roster rules in docs/04 § Roster). */

export const ROSTER_EDITOR_HEAD = {
  eyebrow: 'Officers',
  title: 'Edit the roster',
  lede: 'Each member’s main, spec, raid role and rank. Discord decides who is in the guild and who is an officer. Rank goes both ways: set it here and the Discord Raider, Trial or Social role follows; change the role in Discord and it shows here.',
};

export const EDITOR = {
  search: 'Search members',
  noMain: 'No main yet',
  edit: 'Edit',
  add: 'Add main',
  addTitle: 'Add a main',
  editTitle: 'Edit main',
  name: 'Character',
  namePlaceholder: 'Redtape',
  wowClass: 'Class',
  spec: 'Spec',
  role: 'Raid role',
  rank: 'Rank',
  save: 'Save',
  create: 'Add to roster',
  cancel: 'Cancel',
  remove: 'Remove from roster',
  removeTitle: 'Remove this character?',
  removeBody: 'The member stays; their sign-ups stop counting toward a role until a new main is added.',
  removeConfirm: 'Remove',
  keep: 'Keep it',
  rankFor: (name: string) => `Rank for ${name}`,
  officerRank: 'Set by the Discord Officer role',
  summary: (shown: number, total: number) => `${shown} of ${total} members`,
  empty: 'Nobody matches that search.',
};

export const EDITOR_TOASTS = {
  saved: (name: string) => `Saved ${name}`,
  added: (name: string) => `Added ${name} to the roster`,
  removed: (name: string) => `Removed ${name}`,
  ranked: (name: string, rank: string) => `${name} is now ${rank}`,
};
