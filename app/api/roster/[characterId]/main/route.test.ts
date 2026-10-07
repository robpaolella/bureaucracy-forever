import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), changeMain: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/characters', () => ({ changeMain: mocks.changeMain }));
import { POST } from './route';

const call = () => POST(new Request('http://localhost/api/roster/chosen/main', { method: 'POST' }), {
  params: Promise.resolve({ characterId: 'chosen' }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: 'officer' });
});

it.each([[null, 401], [{ role: 'member' }, 403], [{ role: 'guest' }, 403]])('denies %j with %i before calling the rule', async (session, status) => {
  mocks.session.mockResolvedValue(session);
  const response = await call();
  expect(response.status).toBe(status);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mocks.changeMain).not.toHaveBeenCalled();
});
it('passes only the chosen character id and returns the roster success shape', async () => {
  mocks.changeMain.mockResolvedValue({ status: 200, character: { id: 'chosen', name: 'Sample' } });
  const response = await call();
  expect(mocks.changeMain).toHaveBeenCalledExactlyOnceWith('chosen');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'chosen', name: 'Sample' });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
it.each([
  { status: 404, reason: 'not_found', error: 'No such character.' },
  { status: 409, reason: 'busy', error: 'Characters changed while you were editing. Try again.' },
])('forwards the rule failure with status $status', async (result) => {
  mocks.changeMain.mockResolvedValue(result);
  const response = await call();
  expect(response.status).toBe(result.status);
  expect(await response.json()).toEqual({ error: result.error });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
