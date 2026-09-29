import { describe, expect, it } from 'vitest';
import { moveId, parseBossInput, parseItemInput } from './loot-table-rules';

describe('parseBossInput', () => {
  it('needs a name to create, and trims it', () => {
    expect(parseBossInput({ name: ' Lucifron ', isTrash: false }, true)).toEqual({ ok: true, value: { name: 'Lucifron', isTrash: false } });
    expect(parseBossInput({}, true)).toMatchObject({ ok: false, error: 'Give the boss a name under 60 characters.' });
    expect(parseBossInput({ name: 'x'.repeat(61) }, true)).toMatchObject({ ok: false });
  });

  it('edits any one field and refuses an empty edit or bad values', () => {
    expect(parseBossInput({ move: 'up' }, false)).toEqual({ ok: true, value: { move: 'up' } });
    expect(parseBossInput({ isTrash: true }, false)).toEqual({ ok: true, value: { isTrash: true } });
    expect(parseBossInput({}, false)).toEqual({ ok: false, error: 'Nothing to change.' });
    expect(parseBossInput({ move: 'left' }, false)).toMatchObject({ ok: false });
    expect(parseBossInput({ isTrash: 'yes' }, false)).toMatchObject({ ok: false });
  });
});

describe('moveId', () => {
  it('swaps with the neighbour and stops at the ends', () => {
    expect(moveId(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b', 'c'], 'a', 'up')).toEqual(['a', 'b', 'c']);
    expect(moveId(['a', 'b', 'c'], 'c', 'down')).toEqual(['a', 'b', 'c']);
    expect(moveId(['a'], 'x', 'up')).toEqual(['a']);
  });
});

describe('parseItemInput', () => {
  it('takes the source from a link, else the picker', () => {
    expect(parseItemInput({ ref: 'https://www.wowhead.com/classic/item=17076', source: 'FOREVER' })).toEqual({ ok: true, value: { id: 17076, source: 'CLASSIC' } });
    expect(parseItemInput({ ref: '17076', source: 'FOREVER' })).toEqual({ ok: true, value: { id: 17076, source: 'FOREVER' } });
  });

  it('refuses a bad reference or a missing source', () => {
    expect(parseItemInput({ ref: 'sword', source: 'CLASSIC' })).toEqual({ ok: false, error: 'Paste an item id or a Wowhead item link.' });
    expect(parseItemInput({ ref: '17076' })).toEqual({ ok: false, error: 'Pick Classic or Forever.' });
  });
});
