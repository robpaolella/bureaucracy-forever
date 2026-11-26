import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const saved = { characterId: 'alt', character: { id: 'alt', raidRole: 'HEALER' }, user: { characters: [] } };
  const tx = {
    $executeRaw: vi.fn(),
    signup: { findUnique: vi.fn(), upsert: vi.fn() },
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    character: { findFirst: vi.fn() },
  };
  return { saved, tx };
});
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { $transaction: (run: (tx: unknown) => unknown) => run(h.tx) } }));
vi.mock('@/lib/signup-rules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/signup-rules')>();
  return { ...actual, characterToBring: vi.fn(actual.characterToBring) };
});
import { answerSignup } from './character-switch';
import { characterToBring } from './signup-rules';

const raid = { id: 'raid', templateId: null, discordThreadId: null } as unknown as Parameters<typeof answerSignup>[0]['raid'];
const answer = (keepCharacter?: boolean) => answerSignup({
  raid, userId: 'member', characterId: null, keepCharacter, notOwned: 'no', actor: { role: 'member' },
  decide: () => ({ ok: true, standing: 'ROSTER', response: 'accept' }),
  fields: () => ({ standing: 'ROSTER', response: 'ACCEPT', source: 'WEB', reason: null, setByUserId: null }),
});

describe('answerSignup keepCharacter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tx.signup.findUnique.mockResolvedValue({ standing: 'ROSTER', response: 'ABSENT' });
    h.tx.signup.upsert.mockResolvedValue(h.saved);
    h.tx.user.findUniqueOrThrow.mockResolvedValue({ defaultCharacter: { id: 'main', userId: 'member' }, characters: [] });
  });

  it('gives characterToBring no default, so Undo after Absent keeps the character', async () => {
    expect(await answer(true)).toMatchObject({ ok: true, characterId: 'alt' });
    expect(characterToBring).toHaveBeenCalledWith('absent', 'accept', null, null);
  });

  it('without it, Absent → Accept offers the default', async () => {
    await answer().catch(() => undefined); // the switch to the default needs more of the database than this fake has
    expect(characterToBring).toHaveBeenCalledWith('absent', 'accept', null, 'main');
  });
});
