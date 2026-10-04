import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRaidLootPolling } from '@/components/loot/RaidLoot';

const fetcher = vi.fn();
const receive = vi.fn();
const failure = vi.fn();
const iso = (ms: number) => new Date(ms).toISOString();
const data = { awards: [], startsAt: iso(0), endsAt: iso(120_000) };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset().mockResolvedValue(Response.json(data));
  receive.mockReset();
  failure.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('raid loot polling', () => {
  it('waits 30 seconds, updates just the loot, and stops at the end', async () => {
    const stop = startRaidLootPolling('r1', iso(0), iso(60_000), receive, failure);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledWith('/members/calendar/r1/loot', expect.objectContaining({ cache: 'no-store' }));
    expect(receive).toHaveBeenCalledWith(data);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not fetch a finished raid', async () => {
    const stop = startRaidLootPolling('r1', iso(-60_000), iso(0), receive, failure);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetcher).not.toHaveBeenCalled();
    stop();
  });

  it('starts when an already-open upcoming raid enters its window', async () => {
    const stop = startRaidLootPolling('r1', iso(60_000), iso(120_000), receive, failure);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(receive).toHaveBeenCalledWith(data);
    stop();
  });

  it('retains existing data on transient failure and retries', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline'));
    const stop = startRaidLootPolling('r1', iso(0), iso(120_000), receive, failure);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(failure).toHaveBeenLastCalledWith(true);
    expect(receive).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(failure).toHaveBeenLastCalledWith(false);
    expect(receive).toHaveBeenCalledWith(data);
    stop();
  });

  it.each([401, 403, 404])('removes the list and stops for denied/cancelled response %s', async (status) => {
    fetcher.mockResolvedValue(new Response(null, { status }));
    const stop = startRaidLootPolling('r1', iso(0), iso(120_000), receive, failure);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(receive).toHaveBeenCalledWith(null);
    expect(fetcher).toHaveBeenCalledTimes(1);
    stop();
  });

  it('aborts on unmount and never applies a late response', async () => {
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
    const stop = startRaidLootPolling('r1', iso(0), iso(120_000), receive, failure);
    await vi.advanceTimersByTimeAsync(30_000);
    stop();
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    resolve(Response.json(data));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(receive).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
