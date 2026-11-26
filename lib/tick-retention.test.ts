import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: {} }));
import { LEVEL_MAX_AGE_MS } from './character-level';
import { RETENTION_DAYS } from './tick';

// The bot's character-switch reply carries `level` and is stored as a replay in BotRequest; the
// hourly reconcile deletes rows after RETENTION_DAYS. Outbox payloads carry no level. If this
// fails, a stored copy could outlive Blizzard's 30-day limit (#566).
describe('stored replays and the 30-day level limit', () => {
  it('trims replays at least a day (the hourly sweep plus slack) before a level may be kept', () => {
    expect((RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000).toBeLessThan(LEVEL_MAX_AGE_MS);
  });
});
