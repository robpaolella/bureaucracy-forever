/** Copy for the officer roster editor (roadmap Phase 4; roster rules in docs/04 § Roster). */

export const ROSTER_EDITOR_HEAD = {
  eyebrow: 'Officers',
  title: 'Edit the roster',
  lede: 'Each member’s main, spec, raid role and rank. Discord still decides who is a member or an officer; this is what the roster and the raid counts read.',
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
  summary: (shown: number, total: number) => `${shown} of ${total} members`,
  empty: 'Nobody matches that search.',
};

export const EDITOR_TOASTS = {
  saved: (name: string) => `Saved ${name}`,
  added: (name: string) => `Added ${name} to the roster`,
  removed: (name: string) => `Removed ${name}`,
  taken: 'That character name is already on the roster.',
};
