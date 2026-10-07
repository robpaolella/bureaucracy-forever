import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RAID_LOOT } from '@/content/loot';
import type { RaidLootView } from '@/lib/member-loot';
import { pollRaidLoot, RaidLootList } from './RaidLoot';

const initial: RaidLootView = { startsAt: '2030-01-01T20:00:00Z', endsAt: '2030-01-01T23:00:00Z', live: true, awards: [
  { id: 'a', item: { id: 1, name: 'Blade', icon: 'inv', quality: 4, tooltipHtml: '' }, characterId: 'c1', characterName: 'Treaty', wowClass: 'priest', method: 'SR', roll: 74, bossName: 'Onyxia' },
] };
const render = (loot = initial, failed = false) => renderToStaticMarkup(<RaidLootList loot={loot} failed={failed} />);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(initial.startsAt)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('RaidLoot', () => {
  it('renders the approved columns, character alone, method/roll and live wording', () => {
    const html = render();
    for (const text of [...RAID_LOOT.columns, RAID_LOOT.lede, RAID_LOOT.live, 'Treaty', 'Soft reserve', '74', 'Onyxia']) expect(html).toContain(text);
    expect(html).not.toContain('href='); expect(html).toContain('aria-expanded="false"');
    expect(render({ ...initial, live: false })).not.toContain(RAID_LOOT.live);
    expect(render({ ...initial, awards: [] })).toContain(RAID_LOOT.empty);
  });
  it('shows recorded deleted names uncoloured, bank without a name, and legacy methods', () => {
    const awards = [
      { ...initial.awards[0], characterId: null, wowClass: null, characterName: 'Stipulate', method: 'MAIN_SPEC' as const },
      { ...initial.awards[0], id: 'b', characterId: null, wowClass: null, characterName: null, method: 'DISENCHANT_BANK' as const, roll: null },
      { ...initial.awards[0], id: 'c', method: 'OFF_SPEC' as const },
    ];
    const html = render({ ...initial, awards });
    expect(html).toContain('text-fg">Stipulate</span>'); expect(html).toContain('deleted');
    for (const text of ['Disenchant / bank', 'Main spec', 'Off spec']) expect(html).toContain(text);
  });
  it('polls after 30 seconds, retains the list on failure, announces it and retries to recovery', async () => {
    const next = { ...initial, awards: [...initial.awards, { ...initial.awards[0], id: 'b', characterName: 'Redtape' }] };
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true, json: async () => next });
    vi.stubGlobal('fetch', fetcher);
    let loot = initial, failed = false;
    const stop = pollRaidLoot('r1', initial, (value) => { if (value) loot = value; }, (value) => { failed = value; }, vi.fn());
    await vi.advanceTimersByTimeAsync(29_999); expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(loot).toBe(initial); expect(failed).toBe(true);
    expect(render(loot, failed)).toContain('role="status" class="text-sm text-warn">Loot couldn&#x27;t update. Trying again.');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(failed).toBe(false); expect(loot).toBe(next);
    expect(render(loot, failed)).toContain('Redtape'); expect(render(loot, failed)).not.toContain('Trying again');
    stop(); await vi.advanceTimersByTimeAsync(60_000); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('times out and retries without newer AbortSignal static helpers', async () => {
    vi.stubGlobal('AbortSignal', {}); // Safari 16.4 / Firefox 111 still support AbortController.
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      const signal = init.signal!; signals.push(signal);
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    vi.stubGlobal('fetch', fetcher);
    const failure = vi.fn();
    const stop = pollRaidLoot('r1', initial, vi.fn(), failure, vi.fn());
    await vi.advanceTimersByTimeAsync(30_000); expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(14_999); expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(signals[0].aborted).toBe(true); expect(failure).toHaveBeenCalledWith(true);
    await vi.advanceTimersByTimeAsync(30_000); expect(fetcher).toHaveBeenCalledTimes(2);
    stop(); expect(signals[1].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000); expect(fetcher).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['2030-01-01T19:59:00Z', initial.endsAt])('never polls outside the live window: %s', async (now) => {
    vi.setSystemTime(new Date(now)); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const stop = pollRaidLoot('r1', initial, vi.fn(), vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(120_000); expect(fetcher).not.toHaveBeenCalled(); stop();
  });
  it('aborts an in-flight request at the end and ignores its late response', async () => {
    let resolve!: (response: unknown) => void;
    const fetcher = vi.fn(() => new Promise((r) => { resolve = r; })); vi.stubGlobal('fetch', fetcher);
    vi.setSystemTime(new Date(Date.parse(initial.endsAt) - 60_000));
    const receive = vi.fn(), ended = vi.fn();
    const stop = pollRaidLoot('r1', initial, receive, vi.fn(), ended);
    await vi.advanceTimersByTimeAsync(30_000); expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000); expect(ended).toHaveBeenCalledOnce();
    resolve({ ok: true, json: async () => initial }); await vi.advanceTimersByTimeAsync(60_000);
    expect(receive).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1); stop();
  });
  it.each([401, 403, 404])('removes the list and stops when access is withdrawn (%s)', async (status) => {
    const fetcher = vi.fn().mockResolvedValue({ status }); vi.stubGlobal('fetch', fetcher);
    const receive = vi.fn(); const stop = pollRaidLoot('r1', initial, receive, vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(90_000);
    expect(receive).toHaveBeenCalledWith(null); expect(fetcher).toHaveBeenCalledTimes(1); stop();
  });
});
