import { describe, expect, it } from 'vitest';
import { MENTION_NAME_MAX, MENTIONS_PER_KIND_MAX, parseMentions, ROLE_COLOR_MAX } from './mentions-input';

const USER = '100000000000000001';
const ROLE = '100000000000000002';
const CHANNEL = '100000000000000003';
const full = {
  users: { [USER]: { name: 'Thrall' } },
  roles: { [ROLE]: { name: 'Officer', color: 15844367 } },
  channels: { [CHANNEL]: { name: 'raid-signups' } },
};
const many = (n: number, entry: object) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`1000000000000000${String(i).padStart(3, '0')}`, entry]));
const refused = (raw: unknown) => {
  const r = parseMentions(raw);
  return r.ok ? null : r.error;
};

describe('parseMentions', () => {
  it('accepts a full example as sent', () => {
    expect(parseMentions(full)).toEqual({ ok: true, mentions: full });
  });

  it('is null when absent, null or empty', () => {
    expect(parseMentions(undefined)).toEqual({ ok: true, mentions: null });
    expect(parseMentions(null)).toEqual({ ok: true, mentions: null });
    expect(parseMentions({})).toEqual({ ok: true, mentions: null });
    expect(parseMentions({ users: {}, roles: {} })).toEqual({ ok: true, mentions: null });
  });

  it('keeps only the kinds sent and drops unknown keys', () => {
    expect(parseMentions({ roles: { [ROLE]: { name: 'Officer', color: 0, hoist: true } }, emoji: { x: 1 } }))
      .toEqual({ ok: true, mentions: { roles: { [ROLE]: { name: 'Officer', color: 0 } } } });
    expect(parseMentions({ users: { [USER]: { name: 'Thrall', avatar: 'x' } }, channels: {} }))
      .toEqual({ ok: true, mentions: { users: { [USER]: { name: 'Thrall' } } } });
  });

  it('refuses a value or kind that is not an object', () => {
    expect(refused('x')).toMatch(/mentions must be an object/);
    expect(refused([])).toMatch(/mentions must be an object/);
    expect(refused({ users: [] })).toMatch(/mentions.users must be an object/);
    expect(refused({ channels: 'general' })).toMatch(/mentions.channels must be an object/);
    expect(refused({ users: { [USER]: 'Thrall' } })).toMatch(/mentions.users needs/);
  });

  it('refuses an id that is not a Discord id', () => {
    expect(refused({ users: { abc: { name: 'Thrall' } } })).toMatch(/Discord ids/);
    expect(refused({ roles: { '123': { name: 'Officer', color: 0 } } })).toMatch(/Discord ids/);
    expect(refused({ channels: { [`<#${CHANNEL}>`]: { name: 'general' } } })).toMatch(/Discord ids/);
  });

  it('accepts names of 1 to 100 characters, counting an emoji as one', () => {
    expect(refused({ users: { [USER]: { name: '😀'.repeat(MENTION_NAME_MAX) } } })).toBeNull();
    expect(refused({ users: { [USER]: { name: 'a'.repeat(MENTION_NAME_MAX + 1) } } })).toMatch(/1 to 100 characters/);
    expect(refused({ channels: { [CHANNEL]: { name: '' } } })).toMatch(/1 to 100 characters/);
    expect(refused({ users: { [USER]: {} } })).toMatch(/1 to 100 characters/);
    expect(refused({ roles: { [ROLE]: { name: 5, color: 0 } } })).toMatch(/1 to 100 characters/);
  });

  it('accepts role colours from 0 to 16777215 only, as whole numbers', () => {
    expect(refused({ roles: { [ROLE]: { name: 'Officer', color: 0 } } })).toBeNull();
    expect(refused({ roles: { [ROLE]: { name: 'Officer', color: ROLE_COLOR_MAX } } })).toBeNull();
    expect(refused({ roles: { [ROLE]: { name: 'Officer', color: ROLE_COLOR_MAX + 1 } } })).toMatch(/color from 0 to 16777215/);
    expect(refused({ roles: { [ROLE]: { name: 'Officer', color: -1 } } })).toMatch(/color/);
    expect(refused({ roles: { [ROLE]: { name: 'Officer', color: 1.5 } } })).toMatch(/color/);
    expect(refused({ roles: { [ROLE]: { name: 'Officer', color: '#ff0000' } } })).toMatch(/color/);
    expect(refused({ roles: { [ROLE]: { name: 'Officer' } } })).toMatch(/color/);
  });

  it('accepts 50 entries of a kind and refuses 51', () => {
    expect(refused({ users: many(MENTIONS_PER_KIND_MAX, { name: 'x' }) })).toBeNull();
    expect(refused({ users: many(MENTIONS_PER_KIND_MAX + 1, { name: 'x' }) })).toMatch(/over 50 entries/);
    expect(refused({ roles: many(MENTIONS_PER_KIND_MAX + 1, { name: 'x', color: 0 }) })).toMatch(/mentions.roles has over 50/);
    expect(refused({ channels: many(MENTIONS_PER_KIND_MAX + 1, { name: 'x' }) })).toMatch(/mentions.channels has over 50/);
  });
});
