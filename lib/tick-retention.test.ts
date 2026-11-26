import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: {} }));
import { LEVEL_BOT_MAX_AGE_MS, LEVEL_MAX_AGE_MS, LEVEL_REPLAY_SCRUB_AFTER_MS } from './character-level';
import { RETENTION_DAYS } from './tick';

const HOUR = 60 * 60 * 1000;

// The bot's character-switch and sign-up replies carry `level` and are stored as replays in
// BotRequest. A level in a reply is at most LEVEL_BOT_MAX_AGE_MS old when sent; the hourly
// reconcile scrubs it from the stored reply after LEVEL_REPLAY_SCRUB_AFTER_MS, and deletes the
// whole row after RETENTION_DAYS. If this fails, a stored copy could outlive Blizzard's 30-day
// limit (#566). Outbox payloads carry no level.
describe('stored replays and the 30-day level limit', () => {
  it('scrubs a level from a stored reply before it is 30 days old, allowing an hourly sweep', () => {
    expect(LEVEL_BOT_MAX_AGE_MS + LEVEL_REPLAY_SCRUB_AFTER_MS + HOUR).toBeLessThan(LEVEL_MAX_AGE_MS);
  });
  it('also deletes whole replay rows well before the limit', () => {
    expect(RETENTION_DAYS * 24 * HOUR).toBeLessThan(LEVEL_MAX_AGE_MS);
  });
});
