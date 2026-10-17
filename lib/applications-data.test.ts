import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), card: vi.fn(), users: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { application: { findUnique: mocks.findUnique }, user: { findMany: mocks.users } } }));
vi.mock('@/lib/interviews', () => ({ interviewCard: mocks.card }));
import { loadApplication } from './applications-data';

const row = { id: 'app', path: 'RAIDER', status: 'PENDING', character: 'Thrall', class: 'SHAMAN', spec: 'Enhancement', discordId: 'd1', discordName: 'thrall', logsUrl: null, answers: {}, readAt: null, createdAt: new Date('2026-10-12T00:00:00Z'), decidedAt: null, decidedBy: null, discordThreadId: 'thread', notes: [], messages: [] };
beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(row); mocks.users.mockResolvedValue([]); });

describe('loadApplication interview', () => {
  it('has no interview card when the application never had one', async () => {
    mocks.card.mockResolvedValue(null);
    expect(await loadApplication('app')).toMatchObject({ id: 'app', interview: null });
  });

  it('carries the interview card for the application', async () => {
    const card = { attempt: 2, status: 'AWAITING_TIMES' };
    mocks.card.mockResolvedValue(card);
    expect(await loadApplication('app')).toMatchObject({ interview: card });
    expect(mocks.card).toHaveBeenCalledWith('app');
  });

  it('reads no interview for an unknown application', async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await loadApplication('nope')).toBeNull();
    expect(mocks.card).not.toHaveBeenCalled();
  });
});

const at = (h: number) => new Date(`2026-10-12T0${h}:00:00Z`);
const msg = (o: object) => ({ id: 'm', direction: 'FROM_APPLICANT', authorUserId: null, body: 'hi', createdAt: at(1), status: null, copyChannelId: null, copyMessageId: null, attachments: [], editedAt: null, deletedAt: null, ...o });

describe('loadApplication notes and messages', () => {
  beforeEach(() => { mocks.card.mockResolvedValue(null); vi.stubEnv('DISCORD_GUILD_ID', 'g1'); });

  it('merges notes and messages in time order, with sender names and classes', async () => {
    mocks.users.mockResolvedValue([{ id: 'u1', discordName: 'Ledgerline', characters: [{ class: 'PRIEST' }] }]);
    mocks.findUnique.mockResolvedValue({
      ...row,
      notes: [{ id: 'n1', body: 'note', createdAt: at(2), source: 'WEB', discordMessageId: null, editedAt: null, author: { discordName: 'Redtape', characters: [] } }],
      messages: [msg({ id: 'm1', direction: 'TO_APPLICANT', authorUserId: 'u1', status: 'SENT', createdAt: at(1) }), msg({ id: 'm2', createdAt: at(3) })],
    });
    const { notes } = (await loadApplication('app'))!;
    expect(notes.map((n) => n.id)).toEqual(['m1', 'n1', 'm2']);
    expect(notes[0]).toMatchObject({ kind: 'message', direction: 'to', author: 'Ledgerline', authorClass: 'priest', marker: null });
    expect(notes[2]).toMatchObject({ direction: 'from', author: 'Thrall', authorClass: 'shaman' });
  });

  it('keeps a deleted applicant message with its marker', async () => {
    mocks.findUnique.mockResolvedValue({ ...row, messages: [msg({ deletedAt: at(2), editedAt: at(2) })] });
    expect((await loadApplication('app'))!.notes[0]).toMatchObject({ body: 'hi', marker: 'deleted' });
  });

  it.each([
    [{ direction: 'FROM_APPLICANT', editedAt: at(2) }, 'edited'],
    [{ direction: 'FROM_APPLICANT' }, null],
    [{ direction: 'TO_APPLICANT', status: 'QUEUED', editedAt: at(2) }, null],
    [{ direction: 'TO_APPLICANT', status: 'SENT' }, null],
    [{ direction: 'TO_APPLICANT', status: 'NOT_DELIVERED' }, 'not-delivered'],
    [{ direction: 'TO_APPLICANT', status: 'NOT_SENT' }, 'not-sent'],
  ])('maps %j to the marker %s', async (over, marker) => {
    mocks.findUnique.mockResolvedValue({ ...row, messages: [msg({ authorUserId: 'u1', ...over })] });
    expect((await loadApplication('app'))!.notes[0]).toMatchObject({ marker });
  });

  it('links an attachment to its Discord copy only when there is one and a guild id', async () => {
    mocks.findUnique.mockResolvedValue({ ...row, messages: [msg({ attachments: [{ id: '1' }, { id: '2' }], copyChannelId: 'c', copyMessageId: 'x' }), msg({ id: 'm2', attachments: [{ id: '1' }] })] });
    const [withCopy, without] = (await loadApplication('app'))!.notes;
    expect(withCopy).toMatchObject({ attachmentCount: 2, attachmentUrl: 'https://discord.com/channels/g1/c/x' });
    expect(without).toMatchObject({ attachmentCount: 1, attachmentUrl: null });
    vi.stubEnv('DISCORD_GUILD_ID', '');
    mocks.findUnique.mockResolvedValue({ ...row, messages: [msg({ attachments: [{ id: '1' }], copyChannelId: 'c', copyMessageId: 'x' })] });
    expect((await loadApplication('app'))!.notes[0]).toMatchObject({ attachmentUrl: null });
  });

  it('asks the database for hidden notes only, and every message', async () => {
    await loadApplication('app');
    const select = mocks.findUnique.mock.calls[0][0].select;
    expect(select.notes.where).toEqual({ deletedAt: null });
    expect(select.messages.where).toBeUndefined();
  });
});
