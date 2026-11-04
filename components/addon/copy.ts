/** Copy for /officers/addon: the In-game addon page (design #272, version A). */
export const ADDON_HEAD = {
  eyebrow: 'Officers',
  title: 'In-game addon',
  lede: 'The guild’s loot add-on and its desktop helper, and the keys that connect the helper to the site.',
};

export const HELPER_KEYS = {
  heading: 'Helper keys',
  lede: 'Each key connects one computer’s helper to the site as you. Only you can see your keys.',
  nameLabel: 'Key name',
  nameHint: 'So you can tell your computers apart, such as Rob’s PC.',
  create: 'Create key',
  createdTitle: (name: string) => `Key for ${name}`,
  createdNote: 'Copy this key into the helper now. You won’t be able to see it again.',
  copy: 'Copy',
  copied: 'Copied',
  done: 'Done',
  empty: 'No helper keys yet. Create one for each computer you raid on.',
  created: 'Created',
  lastUsed: 'Last used',
  neverUsed: 'Never used',
  revoke: 'Revoke',
  revokeTitle: (name: string) => `Revoke ${name}?`,
  revokeConfirm: 'The helper on that computer stops working until you give it a new key.',
  revokeAction: 'Revoke key',
  cancel: 'Cancel',
  saveFailed: { title: 'Nothing was saved.', detail: 'Try again.' },
  revokeFailed: { title: 'Nothing was changed.', detail: 'Try again.' },
};

export const GET_ADDON = {
  heading: 'Get the add-on',
  version: 'Version',
  released: 'released',
  download: 'Download the add-on (zip)',
  guide: 'Install and update guide',
  none: 'No release yet. It will appear here once the first version is published.',
  stale: 'Couldn’t check for a newer version just now.',
  unreachable: 'Couldn’t check for the latest version just now.',
  allReleases: 'See all releases on GitHub',
};

export const GET_HELPER = {
  heading: 'Get the helper',
  lede: 'The desktop helper delivers reserves and awards for you. Create a key for it below.',
  mac: 'Download for Mac',
  windows: 'Download for Windows',
};
