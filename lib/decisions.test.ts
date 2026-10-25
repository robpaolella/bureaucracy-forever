import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  application: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { upsert: vi.fn() }, character: { updateMany: vi.fn() },
  interview: { findFirst: vi.fn(), updateMany: vi.fn() },
  enqueue: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: { ...mocks, $transaction: async (fn: (tx: typeof mocks) => unknown) => fn(mocks) } }));
vi.mock('@/lib/outbox', () => ({ enqueue: mocks.enqueue }));
import { decideApplication, reopenApplication } from './decisions';
import { DM_TEMPLATES } from '@/content/dm-templates';

const app = { id: 'app', status: 'PENDING', path: 'RAIDER', character: 'Thrall', discordId: 'applicant', discordName: 'thrall', switchedAt: null };
const jobs = () => mocks.enqueue.mock.calls.map(([type, payload]) => [type, payload]);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.application.findUnique.mockResolvedValue(app);
  mocks.application.updateMany.mockResolvedValue({ count: 1 });
  mocks.interview.findFirst.mockResolvedValue({ id: 'int' });
  mocks.interview.updateMany.mockResolvedValue({ count: 1 });
});

describe('deciding an application with an interview in progress', () => {
  it.each([['web', 'accepted'], ['discord', 'declined']] as const)('closes it from %s, with the decision', async (source, status) => {
    expect(await decideApplication('app', status, { userId: 'officer', name: 'Robert', source })).toBe('decided');
    expect(mocks.interview.findFirst).toHaveBeenCalledWith({ where: { activeKey: 'app' }, select: { id: true } });
    expect(mocks.interview.updateMany).toHaveBeenCalledWith({
      where: { id: 'int', status: { in: ['AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'BOOKED'] } },
      data: { status: 'CLOSED', activeKey: null, endedAt: expect.any(Date), endedById: 'officer' },
    });
    expect(jobs().map(([type]) => type)).toEqual(['application.decide', 'interview.ended']);
    expect(jobs()[1][1]).toEqual({ applicationId: 'app', interviewId: 'int', outcome: 'closed' });
    // Both writes share the decision's transaction.
    expect(mocks.enqueue.mock.calls[1][2]).toBe(mocks);
  });

  it('closes nothing when no interview is active', async () => {
    mocks.interview.findFirst.mockResolvedValue(null);
    expect(await decideApplication('app', 'declined', { userId: 'officer', name: 'Robert', source: 'web' })).toBe('decided');
    expect(mocks.interview.updateMany).not.toHaveBeenCalled();
    expect(jobs().map(([type]) => type)).toEqual(['application.decide']);
  });

  it('leaves the interview alone when another officer decided first', async () => {
    mocks.application.updateMany.mockResolvedValue({ count: 0 });
    expect(await decideApplication('app', 'accepted', { userId: 'officer', name: 'Robert', source: 'discord' })).toBe('conflict');
    expect(mocks.interview.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});

describe('reopening an application', () => {
  it('reopens without touching the retired nudgedAt', async () => {
    mocks.application.findUnique.mockResolvedValue({ id: 'app', status: 'DECLINED' });
    expect(await reopenApplication('app', { userId: 'officer', name: 'Robert', source: 'web' })).toBe('decided');
    const [{ data }] = mocks.application.updateMany.mock.calls[0];
    expect(data).toEqual({ status: 'PENDING', decidedAt: null, decidedByUserId: null, reopenedAt: expect.any(Date), decisionMessageKind: null, decisionMessageText: null, decisionMessageStatus: null, decisionId: null });
    expect(jobs()).toEqual([['application.reopen', { applicationId: 'app', reopenedBy: 'Robert', source: 'web' }]]);
  });
});

describe('decision messages and Accept as (SYNC-SPEC §4, Decision request)', () => {
  const by = { userId: 'officer', name: 'Robert', source: 'discord' } as const;
  const written = () => mocks.application.updateMany.mock.calls[0][0];
  const decide = () => jobs().find(([type]) => type === 'application.decide')![1] as Record<string, unknown>;
  const RAIDER_TEXT = DM_TEMPLATES.raider('Thrall');
  const SOCIAL_TEXT = DM_TEMPLATES.social('Thrall');
  const DECLINE_TEXT = DM_TEMPLATES.declined('Thrall');

  beforeEach(() => {
    mocks.interview.findFirst.mockResolvedValue(null);
    for (const [key, value] of Object.entries({ OFFICER: 'o', MEMBER: 'm', RAIDER: 'r', TRIAL: 't', SOCIAL: 's', GUEST: 'g' })) vi.stubEnv(`DISCORD_ROLE_${key}`, value);
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['standard', { kind: 'standard' }, 'STANDARD', DECLINE_TEXT, 'QUEUED'],
    ['omitted (standard)', undefined, 'STANDARD', DECLINE_TEXT, 'QUEUED'],
    ['custom', { kind: 'custom', text: 'Try again next tier.' }, 'CUSTOM', 'Try again next tier.', 'QUEUED'],
    ['none', { kind: 'none' }, 'NONE', null, null],
  ] as const)('declines with a %s message, stored and queued together', async (_name, message, kind, text, delivery) => {
    expect(await decideApplication('app', 'declined', by, null, { message })).toBe('decided');
    expect(written().where).toEqual({ id: 'app', status: 'PENDING', path: 'RAIDER' });
    const { data } = written();
    expect(data).toMatchObject({ status: 'DECLINED', decisionMessageKind: kind, decisionMessageText: text, decisionMessageStatus: delivery, decisionId: expect.any(String) });
    expect(data).not.toHaveProperty('path');
    expect(decide()).toMatchObject({ status: 'declined', path: 'raider', roles: null, dm: text, decisionId: data.decisionId, switched: false, message: { kind: kind.toLowerCase(), text } });
    expect(mocks.user.upsert).not.toHaveBeenCalled();
  });

  it('gives each decision its own id', async () => {
    await decideApplication('app', 'declined', by);
    await decideApplication('app', 'declined', by);
    const [first, second] = mocks.application.updateMany.mock.calls.map(([{ data }]) => data.decisionId);
    expect(first).not.toBe(second);
  });

  it('accepts a raider as a trial with the raider message', async () => {
    expect(await decideApplication('app', 'accepted', by, null, { acceptAs: 'raider' })).toBe('decided');
    expect(written().data).toMatchObject({ status: 'ACCEPTED', decisionMessageKind: 'STANDARD', decisionMessageText: RAIDER_TEXT, decisionMessageStatus: 'QUEUED' });
    expect(written().data).not.toHaveProperty('switchedAt');
    expect(mocks.user.upsert.mock.calls[0][0].update).toMatchObject({ rank: 'TRIAL', trialStartedAt: expect.any(Date) });
    expect(decide()).toMatchObject({ path: 'raider', roles: { add: ['m', 'r', 't'], remove: ['g', 's'] }, dm: RAIDER_TEXT, switched: false, message: { kind: 'standard', text: RAIDER_TEXT } });
  });

  it('accepts a raider-path application as social: switches, no trial, the social message', async () => {
    expect(await decideApplication('app', 'accepted', by, null, { acceptAs: 'social' })).toBe('decided');
    expect(written().where).toEqual({ id: 'app', status: 'PENDING', path: 'RAIDER' });
    expect(written().data).toMatchObject({ status: 'ACCEPTED', path: 'SOCIAL', switchedAt: expect.any(Date), decisionMessageText: SOCIAL_TEXT });
    expect(mocks.user.upsert.mock.calls[0][0].update).toMatchObject({ rank: 'SOCIAL', trialStartedAt: null });
    expect(mocks.character.updateMany.mock.calls[0][0].data).toEqual({ rank: 'SOCIAL' });
    expect(decide()).toMatchObject({ path: 'social', roles: { add: ['m', 's'], remove: ['g', 'r', 't'] }, dm: SOCIAL_TEXT, switched: true });
  });

  it.each([{ acceptAs: 'social' as const }, {}])('accepts a social-path application plainly (%o)', async (choice) => {
    mocks.application.findUnique.mockResolvedValue({ ...app, path: 'SOCIAL', switchedAt: null });
    expect(await decideApplication('app', 'accepted', by, null, choice)).toBe('decided');
    expect(written().where).toEqual({ id: 'app', status: 'PENDING', path: 'SOCIAL' });
    expect(written().data).not.toHaveProperty('path');
    expect(decide()).toMatchObject({ path: 'social', dm: SOCIAL_TEXT, switched: false });
  });

  it('says switched for an application switched before', async () => {
    mocks.application.findUnique.mockResolvedValue({ ...app, path: 'SOCIAL', switchedAt: new Date('2026-10-01') });
    await decideApplication('app', 'declined', by);
    expect(decide().switched).toBe(true);
  });

  it('keeps the old behaviour for a client that sends no choice', async () => {
    expect(await decideApplication('app', 'accepted', by)).toBe('decided');
    expect(decide()).toMatchObject({ status: 'accepted', path: 'raider', dm: RAIDER_TEXT, switched: false });
    expect(mocks.user.upsert.mock.calls[0][0].update).toMatchObject({ rank: 'TRIAL' });
  });

  it('refuses Accept as raider on a social-path application and changes nothing', async () => {
    mocks.application.findUnique.mockResolvedValue({ ...app, path: 'SOCIAL', switchedAt: null });
    expect(await decideApplication('app', 'accepted', by, null, { acceptAs: 'raider' })).toBe('moved');
    expect(mocks.application.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  describe('moved to social between the read and the update', () => {
    beforeEach(() => {
      mocks.application.updateMany.mockResolvedValueOnce({ count: 0 });
      mocks.application.findUnique.mockResolvedValueOnce(app).mockResolvedValueOnce({ ...app, path: 'SOCIAL', switchedAt: null });
    });

    it('refuses Accept as raider on the re-read, with nothing written', async () => {
      expect(await decideApplication('app', 'accepted', by, null, { acceptAs: 'raider' })).toBe('moved');
      expect(mocks.application.updateMany).toHaveBeenCalledTimes(1);
      expect(mocks.user.upsert).not.toHaveBeenCalled();
      expect(mocks.enqueue).not.toHaveBeenCalled();
    });

    it('decides any other request again on the new path', async () => {
      expect(await decideApplication('app', 'accepted', by)).toBe('decided');
      expect(mocks.application.updateMany.mock.calls[1][0].where).toEqual({ id: 'app', status: 'PENDING', path: 'SOCIAL' });
      expect(mocks.user.upsert).toHaveBeenCalledTimes(1);
      expect(decide()).toMatchObject({ path: 'social', dm: SOCIAL_TEXT });
    });
  });

  it('answers already decided when the re-read finds it decided', async () => {
    mocks.application.updateMany.mockResolvedValueOnce({ count: 0 });
    mocks.application.findUnique.mockResolvedValueOnce(app).mockResolvedValueOnce({ ...app, status: 'ACCEPTED' });
    expect(await decideApplication('app', 'declined', by)).toBe('conflict');
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('reopens clearing the message and decision id, keeping switchedAt', async () => {
    mocks.application.findUnique.mockResolvedValue({ id: 'app', status: 'ACCEPTED' });
    expect(await reopenApplication('app', by)).toBe('decided');
    const { data } = written();
    expect(data).toMatchObject({ decisionMessageKind: null, decisionMessageText: null, decisionMessageStatus: null, decisionId: null });
    expect(data).not.toHaveProperty('switchedAt');
  });
});
