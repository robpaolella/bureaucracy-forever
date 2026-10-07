import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }));
import { addAlt, editCharacter, removeCharacter } from './characters';

const valid = { name: 'Sample', wowClass: 'paladin', spec: 'Protection', role: 'tank' };
const conflict = (code: string) => new Prisma.PrismaClientKnownRequestError('Race', { code, clientVersion: 'test' });
beforeEach(() => vi.clearAllMocks());

it('validates add and edit before starting any transaction', async () => {
  for (const input of [null, {}, { ...valid, name: '1' }, { ...valid, role: 'healer' }]) {
    expect(await addAlt('member', input)).toMatchObject({ status: 400 });
    expect(await editCharacter('member', 'character', input)).toMatchObject({ status: 400 });
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
  expect(await addAlt('member', valid)).toEqual({ status: 409, error: 'Characters changed while you were editing. Try again.' });
  expect(mocks.transaction).toHaveBeenCalledTimes(4);
});
it('does not swallow unexpected database failures', async () => {
  mocks.transaction.mockRejectedValue(new Error('unavailable'));
  await expect(editCharacter('member', 'character', valid)).rejects.toThrow('unavailable');
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
});
