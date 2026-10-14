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
  revokeTitle: 'Revoke key',
  revokeConfirm: (name: string) => `Revoke ${name}? The helper on that computer stops working until you give it a new key.`,
  revokeAction: 'Revoke key',
  cancel: 'Cancel',
  saveFailed: { title: 'Nothing was saved.', detail: 'Try again.' },
  revokeFailed: { title: 'Nothing was changed.', detail: 'Try again.' },
};
