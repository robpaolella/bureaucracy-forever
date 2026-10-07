import { ROSTER_NO_MAIN } from './roster';
/** Copy for the officer roster editor (roadmap Phase 4; roster rules in docs/04 § Roster). */

export const ROSTER_EDITOR_HEAD = {
  eyebrow: 'Officers',
  title: 'Edit the roster',
  lede: 'Each member’s main and alts, specs, raid roles and rank. Discord decides who is in the guild and who is an officer. Rank goes both ways: set it here and the Discord Raider, Trial or Social role follows; change the role in Discord and it shows here.',
};

export const EDITOR = {
  search: 'Search members',
  noMain: ROSTER_NO_MAIN,
  edit: 'Edit',
  add: 'Add main',
  addTitle: 'Add a main',
  addAlt: 'Add alt',
  addAltTitle: 'Add an alt',
  editTitle: 'Edit main',
  editAltTitle: 'Edit alt',
  name: 'Character',
  firstName: 'First name',
  secondName: 'Second name',
  namePlaceholder: 'Red',
  secondNamePlaceholder: 'Tape',
  nameHint: 'First name, and a second name if the character has one, 2 to 12 letters each.',
  wowClass: 'Class',
  spec: 'Spec',
  role: 'Raid role',
  rank: 'Rank',
  save: 'Save',
  create: 'Add to roster',
  createAlt: 'Add alt to roster',
  cancel: 'Cancel',
  remove: 'Remove from roster',
  removeTitle: 'Remove this character?',
  removeBody: 'The member stays; their sign-ups stop counting toward a role until a new main is added.',
  removeAltBody: 'This alt will be removed. The member and their main stay on the roster.',
  removeConfirm: 'Remove',
  makeMain: 'Make main',
  makeMainTitle: (name: string) => `Make ${name} the main?`,
  makeMainBody: 'The current main becomes an alt. Past raids keep the character they recorded.',
  makeMainConfirm: 'Make main',
  keep: 'Keep it',
  rankFor: (name: string) => `Rank for ${name}`,
  officerRank: 'Set by the Discord Officer role',
  summary: (shown: number, total: number) => `${shown} of ${total} members`,
  empty: 'Nobody matches that search.',
};

export const MEMBER_EDITOR = {
  manageCharacters: 'Manage characters',
  title: 'Manage characters',
  main: 'Main',
  addAlt: 'Add alt',
  addAltTitle: 'Add an alt',
  edit: 'Edit',
  editAltTitle: 'Edit alt',
  save: 'Save',
  noMain: 'Set my main in Discord, or ask an officer.',
  removeTitle: 'Remove this alt?',
  removeBody: 'This alt’s reserves for upcoming raids will be removed. Past loot stays under the alt’s name.',
  removeConfirm: 'Remove',
  keep: 'Keep it',
};

export const EDITOR_TOASTS = {
  saved: (name: string) => `Saved ${name}`,
  added: (name: string) => `Added ${name} to the roster`,
  removed: (name: string) => `Removed ${name}`,
  madeMain: (name: string) => `${name} is now the main`,
  ranked: (name: string, rank: string) => `${name} is now ${rank}`,
};

export const OFFICER_RANK_ERROR = 'Officer rank comes from the Discord Officer role and cannot be set here.';
