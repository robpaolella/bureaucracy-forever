import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: {} }));
import { LEVEL_MAX_AGE_MS } from './character-level';
import { RETENTION_DAYS } from './tick';

// The bot's character-switch and sign-up replies carry `level` but are stored for replay without
// it (storable in lib/idempotency.ts, tested there), and outbox payloads carry no level. This
// pins the remaining backstop: the hourly reconcile deletes whole replay rows well inside
// Blizzard's 30-day limit (#566). If it fails, the retention reached the limit.
describe('stored replay retention and the 30-day level limit', () => {
  it('deletes replay rows at least a day before a level may be kept', () => {
    expect((RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000).toBeLessThan(LEVEL_MAX_AGE_MS);
  });
});
