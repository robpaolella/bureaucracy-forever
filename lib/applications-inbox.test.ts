import { describe, expect, it } from 'vitest';
import { countActiveInboxFilters, DEFAULT_FILTERS, defaultSelection, filterInbox, orderedAnswers, selectApplication, sortInbox, type InboxItem } from './applications-inbox';

const item = (over: Partial<InboxItem>): InboxItem => ({
  id: over.character?.toLowerCase() ?? 'x',
  path: 'raider',
  status: 'pending',
  character: 'Footnote',
  wowClass: 'priest',
  spec: 'Holy',
  discordName: 'footnote',
  createdAt: '2026-09-20T00:00:00.000Z',
  unread: true,
  ...over,
});

const items = [
  item({ character: 'Footnote' }),
  item({ character: 'Loophole', wowClass: 'warrior', spec: 'Protection', createdAt: '2026-09-25T00:00:00.000Z', unread: false }),
  item({ character: 'Sidebar', path: 'social', wowClass: null, spec: null }),
  item({ character: 'Stapler', status: 'accepted', createdAt: '2026-09-10T00:00:00.000Z' }),
];

describe('inbox', () => {
  it('defaults to raider + pending and filters by path, status and search', () => {
    expect(filterInbox(items, DEFAULT_FILTERS).map((a) => a.character)).toEqual(['Footnote', 'Loophole']);
    expect(filterInbox(items, { path: 'all', status: 'pending', search: '' })).toHaveLength(3);
    expect(filterInbox(items, { path: 'all', status: 'all', search: 'prot' }).map((a) => a.character)).toEqual(['Loophole']);
    expect(filterInbox(items, { path: 'raider', status: 'accepted', search: '' }).map((a) => a.character)).toEqual(['Stapler']);
  });

  it('counts filters that differ from the default', () => {
    expect(countActiveInboxFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveInboxFilters({ path: 'all', status: 'all', search: 'x' })).toBe(3);
  });

  it('sorts newest first and selects the requested, else the first pending', () => {
    const sorted = sortInbox(items);
    expect(sorted[0].character).toBe('Loophole');
    expect(defaultSelection(sorted, 'stapler')).toBe('stapler');
    expect(defaultSelection(sorted, 'nope')).toBe('loophole');
    expect(defaultSelection([], null)).toBeNull();
  });

  it('opens a requested application even outside the default filter, else the first pending raider', () => {
    expect(selectApplication(items, 'sidebar')).toBe('sidebar');
    expect(selectApplication(items, 'stapler')).toBe('stapler');
    expect(selectApplication(items, 'nope')).toBe('loophole');
    expect(selectApplication(items.filter((a) => a.path === 'social'), null)).toBe('sidebar');
    expect(selectApplication([], null)).toBeNull();
  });

  it('orders answers by the form’s questions and keeps unknown keys', () => {
    expect(orderedAnswers({ wipe: 'Stood in fire.', availability: 'Both nights', extra: 'x', empty: '  ' }).map((a) => a.key)).toEqual(['availability', 'wipe', 'extra']);
    expect(orderedAnswers(null)).toEqual([]);
  });
});
