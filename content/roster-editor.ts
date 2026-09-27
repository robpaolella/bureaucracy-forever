import { ROSTER_NO_MAIN } from './roster';
/** Copy for the officer roster editor (roadmap Phase 4; roster rules in docs/04 § Roster). */

export const ROSTER_EDITOR_HEAD = {
  eyebrow: 'Officers',
  title: 'Edit the roster',
  lede: 'Each member’s main, spec, raid role and rank. Discord decides who is in the guild and who is an officer. Rank goes both ways: set it here and the Discord Raider, Trial or Social role follows; change the role in Discord and it shows here.',
};

export const EDITOR = {
  search: 'Search members',
  noMain: ROSTER_NO_MAIN,
  edit: 'Edit',
  add: 'Add main',
  addTitle: 'Add a main',
  editTitle: 'Edit main',
  name: 'Character',
  firstName: 'First name',
  secondName: 'Second name',
  namePlaceholder: 'Red',
  secondNamePlaceholder: 'Tape',
  nameHint: 'Two names, 2 to 12 letters each, as on WoW Forever.',
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

export const OFFICER_RANK_ERROR = 'Officer rank comes from the Discord Officer role and cannot be set here.';

/** The two-week check-in tick posts to #officer-chat (docs/04 § Roster, trials). */
export const TRIAL_CHECK_IN = (who: string, days: number, rosterUrl: string) => `${who}'s trial started ${days} days ago. Decide on the roster editor: Raider keeps them, Social ends it. ${rosterUrl}`;
