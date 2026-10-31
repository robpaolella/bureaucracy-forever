import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: null as null | { discordId: string; role: string; availabilitySubmitted: boolean }, cards: vi.fn(), findUnique: vi.fn(), templates: vi.fn() }));
class NotFound extends Error {}
vi.mock('next/navigation', () => ({ notFound: () => { throw new NotFound(); } }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/raid-cards', () => ({ loadRaidCards: mocks.cards, loadActiveTemplates: mocks.templates }));
vi.mock('@/components/calendar/CalendarList', () => ({ CalendarList: () => null }));
import CalendarPage from './page';

const searchParams = Promise.resolve({});
beforeEach(() => { vi.clearAllMocks(); mocks.cards.mockResolvedValue([]); mocks.findUnique.mockResolvedValue(null); mocks.templates.mockResolvedValue([]); });

it.each([null, 'social'])('gives %s the not-found page before reading any raid', async (role) => {
  mocks.session = role ? { discordId: 'viewer', role, availabilitySubmitted: false } : null;
  await expect(CalendarPage({ searchParams })).rejects.toBeInstanceOf(NotFound);
  expect(mocks.cards).not.toHaveBeenCalled();
  expect(mocks.findUnique).not.toHaveBeenCalled();
  expect(mocks.templates).not.toHaveBeenCalled();
});

it.each(['member', 'officer'])('shows a %s the calendar', async (role) => {
  mocks.session = { discordId: 'viewer', role, availabilitySubmitted: true };
  await CalendarPage({ searchParams });
  expect(mocks.cards).toHaveBeenCalledTimes(1);
});
