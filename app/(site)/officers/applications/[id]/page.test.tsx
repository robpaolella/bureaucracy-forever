import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: null as { role: string } | null, load: vi.fn() }));
class NotFound extends Error {}
vi.mock('next/navigation', () => ({ notFound: () => { throw new NotFound(); } }));
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/applications-data', () => ({ loadApplication: mocks.load, markRead: vi.fn() }));
vi.mock('@/components/applications/ApplicationView', () => ({ ApplicationView: () => null }));
import ApplicationPage from './page';

beforeEach(() => { vi.clearAllMocks(); });

describe('officer application page', () => {
  it.each([null, { role: 'member' }, { role: 'guest' }])('gives %j the not-found page and reads no application or interview', async (session) => {
    mocks.session = session;
    await expect(ApplicationPage({ params: Promise.resolve({ id: 'app' }) })).rejects.toBeInstanceOf(NotFound);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('shows an officer the application with its interview', async () => {
    mocks.session = { role: 'officer' };
    mocks.load.mockResolvedValue({ id: 'app', unread: false, discordThreadId: null, interview: { status: 'BOOKED' } });
    const page = await ApplicationPage({ params: Promise.resolve({ id: 'app' }) });
    expect(JSON.stringify(page)).toContain('BOOKED');
  });
});
