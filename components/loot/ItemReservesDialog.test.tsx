import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SAVE_FAILED } from '@/content/calendar';
import { LOOT_RESERVES } from '@/content/loot-admin';
import { Confirmation, limitToast, WinLimitCounter } from './ItemReservesDialog';

const render = (value: number | null, blocked = false) => renderToStaticMarkup(<WinLimitCounter value={value} blocked={blocked} busy={false} onStep={() => {}} />);
const disabled = (html: string, step: 'lower' | 'raise') => new RegExp(`<button[^>]*data-step="${step}"[^>]*disabled=""`).test(html);

describe('WinLimitCounter', () => {
  it('disables − at 1 and keeps + on', () => {
    const html = render(1);
    expect(disabled(html, 'lower')).toBe(true);
    expect(disabled(html, 'raise')).toBe(false);
    expect(html).toContain(LOOT_RESERVES.limitHint);
    expect(html).not.toContain(LOOT_RESERVES.limitMax(5));
  });

  it('enables both in between', () => {
    const html = render(3);
    expect(disabled(html, 'lower')).toBe(false);
    expect(disabled(html, 'raise')).toBe(false);
  });

  it('disables + at 5 and says it is the most', () => {
    const html = render(5);
    expect(disabled(html, 'lower')).toBe(false);
    expect(disabled(html, 'raise')).toBe(true);
    expect(html).toContain(`${LOOT_RESERVES.limitHint} ${LOOT_RESERVES.limitMax(5)}`);
  });

  it('waits for the stored value: both disabled, no number guessed', () => {
    const html = render(null);
    expect(disabled(html, 'lower')).toBe(true);
    expect(disabled(html, 'raise')).toBe(true);
    expect(html).toMatch(/<output[^>]*>–<\/output>/);
  });

  it('greys a blocked item, keeping its stored limit', () => {
    const html = render(3, true);
    expect(disabled(html, 'lower')).toBe(true);
    expect(disabled(html, 'raise')).toBe(true);
    expect(html).toMatch(/<output[^>]*>3<\/output>/);
    expect(html).toContain('opacity-50');
    expect(html).toContain(LOOT_RESERVES.limitBlocked.replace("'", '&#x27;'));
    expect(render(3)).not.toContain(LOOT_RESERVES.limitBlocked.replace("'", '&#x27;'));
  });
});

describe('limitToast', () => {
  it('says the new limit after a raise', () => {
    expect(limitToast(true, 1, 2)).toEqual({ tone: 'ok', title: 'Win limit 2.' });
  });

  it('says existing reserves stay after a lower', () => {
    expect(limitToast(true, 3, 2)).toEqual({ tone: 'ok', title: 'Win limit 2. Existing reserves stay.' });
  });

  it('offers Retry on failure, resending the same change', () => {
    const resend = vi.fn();
    const toast = limitToast(false, 3, 2, resend);
    expect(toast).toMatchObject({ tone: 'stop', title: SAVE_FAILED, action: { label: 'Retry' } });
    expect(SAVE_FAILED).toBe("Couldn't save that — try again.");
    toast.action?.onClick();
    expect(resend).toHaveBeenCalledExactlyOnceWith(3, 2);
  });

  it('has no Retry once the window has moved on', () => {
    expect(limitToast(false, 1, 2).action).toBeUndefined();
  });
});

describe('Confirmation', () => {
  it('reads as guild time, once, until the viewer zone is known', () => {
    // Wed, Oct 7 2026, 8:00 PM in Los Angeles.
    const raid = { id: 'r1', name: 'Molten Core', startsAt: '2026-10-08T03:00:00.000Z', cancelled: false };
    const html = renderToStaticMarkup(<Confirmation holders={[{ key: 'k1', character: 'Redtape', kind: 'SR', raid }]} stale={false} />);
    expect(html.replace(/<[^>]+>/g, '')).toContain('Molten Core Wed, Oct 7, 8:00 PM guild time');
    expect(html).not.toContain('role="tooltip"');
  });
});
