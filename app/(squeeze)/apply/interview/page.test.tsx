import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ session: null as { discordId: string; name: string; role: string } | null, applicantInterview: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session, getDevStubSession: async () => undefined }));
vi.mock('@/lib/guild-check', () => ({ isGuildMember: vi.fn() }));
vi.mock('@/lib/interviews', () => ({ applicantInterview: mocks.applicantInterview }));

import InterviewPage, { metadata } from './page';

const base = { id: 'iv1', applicationId: 'app1', endReason: null, slots: [] as string[], proposedStart: null, bookedStart: null };
const render = async (props?: unknown) => renderToStaticMarkup(await (InterviewPage as (p?: unknown) => Promise<React.ReactElement>)(props));

beforeEach(() => {
  mocks.session = null;
  mocks.applicantInterview.mockReset();
});

describe('/apply/interview', () => {
  it('is kept out of search', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('asks a signed-out visitor to sign in, returning to this page, and never reads an interview', async () => {
    const html = await render();
    expect(html).toContain('Sign in to share your times');
    expect(html).toContain('href="/login?back=%2Fapply%2Finterview"');
    expect(mocks.applicantInterview).not.toHaveBeenCalled();
  });

  it("shows a Guest (social) their own interview, whatever the address asks for", async () => {
    mocks.session = { discordId: '1', name: 'Quillfeather', role: 'social' };
    mocks.applicantInterview.mockResolvedValue({ ...base, status: 'DONE' });
    const html = await render({ searchParams: Promise.resolve({ id: 'someone-else', discordId: '2' }), params: Promise.resolve({}) });
    expect(html).toContain('Thanks for talking with us');
    expect(mocks.applicantInterview).toHaveBeenCalledExactlyOnceWith('1');
  });

  it('shows nothing to schedule to an account with no interview', async () => {
    mocks.session = { discordId: '3', name: 'Redtape', role: 'member' };
    mocks.applicantInterview.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain('Nothing to schedule');
    expect(html).toContain('Back to the home page');
  });

  it.each([
    ['TIMES_RECEIVED', { slots: ['2026-10-17T17:00:00.000Z', '2026-10-17T17:30:00.000Z'] }, ['Your times are with the officers', 'Your times · 1 hour', 'Saturday 17 Oct', '10:00 – 11:00 AM guild time']],
    ['BOOKED', { bookedStart: '2026-10-18T02:00:00.000Z' }, ['Your interview is booked', 'Saturday 17 Oct, 7:00 PM guild time', 'Public Lounge', 'Open Discord']],
    ['CANCELLED', { bookedStart: '2026-10-18T02:00:00.000Z' }, ['Your interview was cancelled', 'Your interview on', 'Saturday 17 Oct, 7:00 PM guild time', 'has been cancelled. An officer will be in touch.']],
    ['CANCELLED', {}, ['Your interview was cancelled', 'Your interview has been cancelled. An officer will be in touch.']],
    ['NO_TIME', {}, ['We couldn’t find a time', 'An officer will reach out to you directly to arrange one.']],
    ['CLOSED', {}, ['This interview is closed', 'because your application has been decided']],
    ['DONE', {}, ['Thanks for talking with us', 'within a few days']],
  ])('shows the %s state', async (status, extra, texts) => {
    mocks.session = { discordId: '1', name: 'Quillfeather', role: 'social' };
    mocks.applicantInterview.mockResolvedValue({ ...base, status, ...extra });
    const html = await render();
    for (const text of texts) expect(html).toContain(text);
    expect(html).not.toContain('Change my times');
  });
});
