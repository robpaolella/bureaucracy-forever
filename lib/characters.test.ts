import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }));
vi.mock('@/lib/roles-sync', () => ({ refreshPostedRaidsForCharacter: vi.fn() }));
import { addAlt, addMain, changeMain, editCharacter, removeCharacter } from './characters';

const valid = { name: 'Sample Name', wowClass: 'paladin', spec: 'Protection', role: 'tank' };
const conflict = (code: string) => new Prisma.PrismaClientKnownRequestError('Race', { code, clientVersion: 'test' });
beforeEach(() => vi.clearAllMocks());

it('validates add and edit before starting any transaction', async () => {
  for (const input of [null, {}, { ...valid, name: '1' }, { ...valid, name: 'Sample' }, { ...valid, role: 'healer' }]) {
    expect(await addAlt('member', input)).toMatchObject({ status: 400, reason: 'invalid' });
    expect(await addMain('member', input)).toMatchObject({ status: 400, reason: 'invalid' });
    expect(await editCharacter('member', 'character', input)).toMatchObject({ status: 400, reason: 'invalid' });
  }
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it.each(['P2002', 'P2034', 'P2025'])('retries %s without guessing which constraint failed', async (code) => {
  const result = { status: 404, error: 'No such character.' };
  mocks.transaction.mockRejectedValueOnce(conflict(code)).mockResolvedValueOnce(result);
  expect(await removeCharacter('member', 'character')).toEqual(result);
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
  expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
});
it('retries a pg adapter serialization failure at commit', async () => {
  const error = new Error('TransactionWriteConflict', { cause: { kind: 'TransactionWriteConflict' } });
  error.name = 'DriverAdapterError';
  mocks.transaction.mockRejectedValueOnce(error).mockResolvedValueOnce({ status: 201 });
  expect(await addAlt('member', valid)).toEqual({ status: 201 });
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
});
it('bounds retries and gives an honest conflict rather than a name-index guess', async () => {
  mocks.transaction.mockRejectedValue(conflict('P2002'));
  expect(await addAlt('member', valid)).toEqual({ status: 409, reason: 'busy', error: 'Characters changed while you were editing. Try again.' });
  expect(mocks.transaction).toHaveBeenCalledTimes(4);
});
it('checks alt-only removal inside the transaction, even for a sole main', async () => {
  const tx = { character: { findFirst: vi.fn().mockResolvedValue({ id: 'character', isMain: true }), delete: vi.fn(), count: vi.fn() } };
  mocks.transaction.mockImplementationOnce((run) => run(tx));
  expect(await removeCharacter('member', 'character', { altOnly: true })).toEqual({ status: 409, reason: 'main', error: 'Only alt characters can be removed.' });
  expect(tx.character.findFirst).toHaveBeenCalledWith({ where: { id: 'character', userId: 'member' } });
  expect(tx.character.delete).not.toHaveBeenCalled();
  expect(tx.character.count).not.toHaveBeenCalled();
  expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
});
it('checks alt-only editing inside the transaction before writing', async () => {
  const tx = { character: { findFirst: vi.fn().mockResolvedValue({ id: 'character', isMain: true }), update: vi.fn() } };
  mocks.transaction.mockImplementationOnce((run) => run(tx));
  expect(await editCharacter('member', 'character', valid, { altOnly: true })).toEqual({ status: 409, reason: 'main', error: 'Only alt characters can be edited.' });
  expect(tx.character.findFirst).toHaveBeenCalledExactlyOnceWith({ where: { id: 'character', userId: 'member' } });
  expect(tx.character.update).not.toHaveBeenCalled();
  expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
});
it('retries an add-main as a whole after a serialization conflict', async () => {
  mocks.transaction.mockRejectedValueOnce(conflict('P2034')).mockResolvedValueOnce({ status: 200 });
  expect(await addMain('member', valid)).toEqual({ status: 200 });
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
  expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
});
it('retries a main swap as a whole after a serialization conflict', async () => {
  mocks.transaction.mockRejectedValueOnce(conflict('P2034')).mockResolvedValueOnce({ status: 200 });
  expect(await changeMain('chosen')).toEqual({ status: 200 });
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
});
it('does not swallow unexpected database failures', async () => {
  mocks.transaction.mockRejectedValue(new Error('unavailable'));
  await expect(editCharacter('member', 'character', valid)).rejects.toThrow('unavailable');
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
});

describe('member.classes.sync', () => {
  const tx = {
    user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() }, signup: { updateMany: vi.fn() }, outboxJob: { create: vi.fn() },
    character: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  };
  const druidMain = { id: 'main', userId: 'member', name: 'Main Name', class: 'DRUID', isMain: true, raidRole: 'TANK' };
  const queued = () => tx.outboxJob.create.mock.calls.map(([{ data }]) => { expect(data.type).toBe('member.classes.sync'); return data.payload; });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation((run) => run(tx));
    tx.user.findUniqueOrThrow.mockResolvedValue({ rank: 'RAIDER', discordId: '100000000000000001' });
    tx.user.findUnique.mockResolvedValue({ rank: 'RAIDER', characters: [druidMain] });
    tx.outboxJob.create.mockResolvedValue({ id: 'job' });
  });
  const discordId = '100000000000000001';

  it('adding a Mage alt queues its class without the main', async () => {
    tx.character.create.mockResolvedValue({ id: 'alt', class: 'MAGE', isMain: false });
    expect(await addAlt('member', { ...valid, wowClass: 'mage', spec: 'Frost', role: 'ranged' })).toMatchObject({ status: 201 });
    expect(queued()).toEqual([{ discordId, classes: ['mage'], main: false }]);
    expect(tx.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'member' }, select: { discordId: true } });
  });
  it('adding a main queues its class with the main', async () => {
    tx.user.findUnique.mockResolvedValue({ rank: 'RAIDER', characters: [] });
    tx.character.create.mockResolvedValue({ id: 'main', class: 'PALADIN', isMain: true });
    expect(await addMain('member', valid)).toMatchObject({ status: 201 });
    expect(queued()).toEqual([{ discordId, classes: ['paladin'], main: true }]);
  });
  it('changing a Druid main to a Warrior queues both classes with the main', async () => {
    tx.character.findFirst.mockResolvedValueOnce(druidMain).mockResolvedValueOnce(null);
    tx.character.update.mockResolvedValue({ ...druidMain, class: 'WARRIOR' });
    expect(await editCharacter('member', 'main', { ...valid, wowClass: 'warrior' })).toMatchObject({ status: 200 });
    expect(queued()).toEqual([{ discordId, classes: ['druid', 'warrior'], main: true }]);
  });
  it('making a Warrior alt the main over a Druid main queues both classes with the main', async () => {
    const warrior = { ...druidMain, id: 'alt', class: 'WARRIOR', isMain: false };
    tx.character.findUnique.mockResolvedValue(warrior);
    tx.character.findFirst.mockResolvedValue(druidMain);
    tx.character.update.mockResolvedValueOnce({ ...druidMain, isMain: false }).mockResolvedValueOnce({ ...warrior, isMain: true });
    expect(await changeMain('alt')).toMatchObject({ status: 200 });
    expect(queued()).toEqual([{ discordId, classes: ['druid', 'warrior'], main: true }]);
  });
  it.each([false, true])('removing a character queues its class (main: %s)', async (isMain) => {
    const character = { ...druidMain, isMain };
    tx.character.findFirst.mockResolvedValue(character);
    tx.character.count.mockResolvedValue(0);
    tx.character.delete.mockResolvedValue(character);
    expect(await removeCharacter('member', 'main')).toMatchObject({ status: 200 });
    expect(queued()).toEqual([{ discordId, classes: ['druid'], main: isMain }]);
  });
  it('queues nothing for a name, spec or raid-role edit, a repeat or a refused change', async () => {
    tx.character.findFirst.mockResolvedValueOnce(druidMain).mockResolvedValueOnce(null);
    tx.character.update.mockResolvedValue({ ...druidMain, name: 'Fresh Name', raidRole: 'HEALER' });
    expect(await editCharacter('member', 'main', { ...valid, name: 'Fresh Name', wowClass: 'druid', spec: 'Restoration', role: 'healer' })).toMatchObject({ status: 200 });
    // Repeats: the same main made main again, a retried alt add, a retried add-main, an alt already gone.
    tx.character.findUnique.mockResolvedValue(druidMain);
    expect(await changeMain('main')).toMatchObject({ status: 200 });
    tx.character.findFirst.mockResolvedValueOnce({ ...druidMain, id: 'alt', name: 'Sample Name', isMain: false });
    expect(await addAlt('member', valid)).toMatchObject({ status: 200 });
    tx.user.findUnique.mockResolvedValueOnce({ rank: 'RAIDER', characters: [{ ...druidMain, name: 'Sample Name' }] });
    expect(await addMain('member', valid)).toMatchObject({ status: 200 });
    tx.character.findFirst.mockResolvedValueOnce(null);
    expect(await removeCharacter('member', 'alt')).toMatchObject({ status: 404 });
    // Refusals: a second main, a taken name, a main with alts.
    expect(await addMain('member', { ...valid, name: 'Other Name' })).toMatchObject({ status: 409, reason: 'has_main' });
    tx.character.findFirst.mockResolvedValueOnce({ ...druidMain, userId: 'other', name: 'Sample Name' });
    expect(await addAlt('member', valid)).toMatchObject({ status: 409, reason: 'name_taken' });
    tx.character.findFirst.mockResolvedValueOnce(druidMain);
    tx.character.count.mockResolvedValue(1);
    expect(await removeCharacter('member', 'main')).toMatchObject({ status: 409, reason: 'main' });
    expect(tx.outboxJob.create).not.toHaveBeenCalled();
  });
});
