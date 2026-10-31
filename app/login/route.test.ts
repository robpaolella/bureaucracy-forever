import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: null as null | { role: string }, signIn: vi.fn() }));
vi.mock('@/auth', () => ({ signIn: mocks.signIn }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => false }));
import { GET } from './route';

const login = (back: string) => GET(new NextRequest(`https://www.bureauguild.com/login?back=${encodeURIComponent(back)}`));
beforeEach(() => { mocks.signIn.mockReset(); });

it('sends the signed-out to Discord, coming back through login with the same back path', async () => {
  mocks.session = null;
  await login('/members/calendar/r1?reserves=1');
  expect(mocks.signIn).toHaveBeenCalledWith('discord', { redirectTo: '/login?back=%2Fmembers%2Fcalendar%2Fr1%3Freserves%3D1' });
});

it('lands a social sent from a Members page on home, never a 404', async () => {
  mocks.session = { role: 'social' };
  for (const back of ['/members/roster', '/members/calendar', '/members/calendar/r1?reserves=1']) {
    const res = await login(back);
    expect(res?.headers.get('location')).toBe('https://www.bureauguild.com/');
  }
  expect(mocks.signIn).not.toHaveBeenCalled();
});

it.each(['member', 'officer'])('lands a %s on the page they set out for', async (role) => {
  mocks.session = { role };
  const res = await login('/members/calendar/r1?reserves=1');
  expect(res?.headers.get('location')).toBe('https://www.bureauguild.com/members/calendar/r1?reserves=1');
});

it('keeps an off-site back path out', async () => {
  mocks.session = { role: 'member' };
  const res = await login('//evil.example/members');
  expect(res?.headers.get('location')).toBe('https://www.bureauguild.com/');
});
