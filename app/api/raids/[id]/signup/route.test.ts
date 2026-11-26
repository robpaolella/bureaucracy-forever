import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  signups: [] as unknown[],
  answer: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ discordId: 'member', name: 'Sample', role: 'member' }) }));
vi.mock('@/lib/outbox', () => ({ enqueue: vi.fn() }));
vi.mock('@/lib/character-switch', () => ({ answerSignup: state.answer, lockSignup: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: {
    raid: { findUnique: async () => ({ id: 'raid', cancelledAt: null, startsAt: new Date('2099-01-01T20:00:00Z'), durationMin: 180, discordThreadId: null, templateId: 't', status: 'SCHEDULED', locksAt: new Date('2099-01-01T20:00:00Z') }) },
    user: { upsert: async () => ({ id: 'member' }) },
    signup: { findMany: async () => state.signups },
  },
}));
import { PUT } from './route';

const put = (body: unknown) => PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'raid' }) });
const main = { id: 'main', raidRole: 'HEALER' };
const alt = { id: 'alt', raidRole: 'RANGED' };

beforeEach(() => { state.answer.mockReset(); state.answer.mockResolvedValue({ ok: true }); });

describe('PUT /api/raids/[id]/signup reply', () => {
  it('names the role of the character the first Accept brought (the default, none chosen)', async () => {
    state.signups = [{ userId: 'member', response: 'ACCEPT', standing: 'ROSTER', character: alt, user: { characters: [main] } }];
    const body = await (await put({ response: 'accept' })).json();
    expect(body).toMatchObject({ characterId: 'alt', role: 'ranged', counts: { ranged: 1, healer: 0 } });
  });

  it('falls back to the main when the row has no chosen character', async () => {
    state.signups = [{ userId: 'member', response: 'ACCEPT', standing: 'ROSTER', character: null, user: { characters: [main] } }];
    expect(await (await put({ response: 'accept' })).json()).toMatchObject({ characterId: 'main', role: 'healer' });
  });

  it('has a null role when no character is brought', async () => {
    state.signups = [{ userId: 'member', response: 'ACCEPT', standing: 'ROSTER', character: null, user: { characters: [] } }];
    expect(await (await put({ response: 'accept' })).json()).toMatchObject({ characterId: null, role: null });
  });
});
