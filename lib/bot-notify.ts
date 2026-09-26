import 'server-only';

import { randomUUID } from 'node:crypto';
import { botRequestHeaders } from '@/lib/bot-auth';
import { envelope, type BotEvent } from '@/lib/bot-events';

export const NOTIFY_TIMEOUT_MS = 5000;

export type NotifyOutcome = 'sent' | 'skipped' | 'failed';

/** Both halves of the link must be configured before anything is sent. */
export function botConfigured(): boolean {
  return Boolean(process.env.BOT_SHARED_SECRET && process.env.BOT_WEBHOOK_URL);
}

/**
 * Tell the bot something happened (docs/06 § Discord bot sync). Signed like the inbound
 * routes, sent with a short timeout, and never thrown: a bot that is down must not fail a
 * member's sign-up. Callers run it in `after()` so the response goes out first.
 */
export async function notifyBot(event: BotEvent, fetchImpl: typeof fetch = fetch, now: Date = new Date()): Promise<NotifyOutcome> {
  const secret = process.env.BOT_SHARED_SECRET;
  const url = process.env.BOT_WEBHOOK_URL;
  if (!secret || !url) return 'skipped';
  const body = JSON.stringify(envelope(event, now, randomUUID()));
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: botRequestHeaders(secret, body, Math.floor(now.getTime() / 1000)), body, signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`bot notify ${event.type}: ${res.status}`);
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.warn(`bot notify ${event.type}: ${error instanceof Error ? error.message : String(error)}`);
    return 'failed';
  }
}
