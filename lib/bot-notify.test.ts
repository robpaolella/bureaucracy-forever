import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyBotRequest } from './bot-auth';
import { notifyBot } from './bot-notify';

describe('notifyBot', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('skips when the link is not configured', async () => {
    vi.stubEnv('BOT_SHARED_SECRET', '');
    vi.stubEnv('BOT_WEBHOOK_URL', '');
    const fetchImpl = vi.fn();
    expect(await notifyBot({ type: 'availability.nudge', members: [] }, fetchImpl as unknown as typeof fetch)).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends a signed envelope the inbound verifier accepts', async () => {
    vi.stubEnv('BOT_SHARED_SECRET', 'shared');
    vi.stubEnv('BOT_WEBHOOK_URL', 'http://bot.local/hook');
    const now = new Date('2027-01-01T00:00:00.000Z');
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    const out = await notifyBot({ type: 'raid.cancelled', raid: { id: 'r1', name: 'MC', startsAt: '2027-01-02T03:00:00.000Z', durationMin: 180, notes: null, cancelled: true, requirements: { tank: 2, healer: 8, melee: 9, ranged: 11 }, discordEventId: null } }, fetchImpl, now);
    expect(out).toBe('sent');
    expect(calls[0].url).toBe('http://bot.local/hook');
    const headers = calls[0].init.headers as Record<string, string>;
    const body = calls[0].init.body as string;
    expect(verifyBotRequest({ get: (n) => headers[n] ?? null }, body, 'shared', Math.floor(now.getTime() / 1000))).toEqual({ ok: true });
    const parsed = JSON.parse(body);
    expect(parsed.event.type).toBe('raid.cancelled');
    expect(parsed.sentAt).toBe(now.toISOString());
    expect(typeof parsed.id).toBe('string');
  });

  it('reports a failure without throwing', async () => {
    vi.stubEnv('BOT_SHARED_SECRET', 'shared');
    vi.stubEnv('BOT_WEBHOOK_URL', 'http://bot.local/hook');
    const failing = (async () => new Response('nope', { status: 500 })) as typeof fetch;
    const throwing = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await notifyBot({ type: 'availability.nudge', members: [] }, failing)).toBe('failed');
    expect(await notifyBot({ type: 'availability.nudge', members: [] }, throwing)).toBe('failed');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
