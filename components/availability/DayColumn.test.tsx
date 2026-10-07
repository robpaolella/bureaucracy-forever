import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyPaintRun, dayBlocks, weekDays, type Block, type Week } from '@/lib/availability';
import { AvailabilityEditor } from './AvailabilityEditor';
import { DayColumn } from './DayColumn';

const zone = 'America/New_York';
// Tuesday 6 Oct is today, so the column opens on it.
const days = weekDays(new Date('2026-10-06T12:00:00Z'), zone);
/** The approved typical Tuesday: 7:00–11:00 PM available, then if needed to midnight; Thu 6:30 PM. */
const week: Week = {
  ...applyPaintRun({}, 1, 38, 45, 'available'),
  ...applyPaintRun({}, 1, 46, 47, 'if-needed'),
  '3:37': 'if-needed',
};
const [tue] = dayBlocks(week, 1);
const [thu] = dayBlocks(week, 3);

const render = (selected: Block | null) =>
  renderToStaticMarkup(
    <DayColumn week={week} days={days} offsetSlots={2} zone={zone} slotAt={() => '2026-10-05T04:00:00.000Z'} mode="available" onWeek={() => {}} selected={selected} onSelect={() => {}} onOpenDay={() => {}} />,
  );

describe('DayColumn blocks', () => {
  it("draws the shown day's runs once, with range, state word and screen-reader name", () => {
    const html = render(null);
    const text = html.replace(/<!-- -->|<[^>]+>/g, '');
    expect(html.match(/role="listitem"/g)).toHaveLength(2);
    expect(text).toContain('7:00 – 11:00 PMAvailable');
    expect(text).toContain('11:00 PM – 12:00 AMIf needed');
    expect(html).toContain('Available, Tuesday 7:00 PM to 11:00 PM');
    expect(html).not.toContain('If needed, Thursday');
    // No per-cell buttons: the day switcher's list is the keyboard route.
    expect(html).not.toContain('data-key');
    expect(html).toContain('aria-label="Tuesday 6 Oct: set hours from a list"');
  });

  it('shows the phone hint', () => {
    expect(render(null)).toContain('Tap a half-hour to paint it, or tap a block to resize or remove it. Hold, then drag, to paint a run. Swipe sideways for another day.');
  });

  it('gives only the selected block handles and a × out of the tab order', () => {
    expect(render(null)).not.toContain('data-edge');
    expect(render(null)).not.toContain('Remove ');
    const html = render(tue);
    expect(html.match(/data-edge=/g)).toHaveLength(2);
    expect(html).toMatch(/<button[^>]*tabindex="-1"[^>]*aria-label="Remove available 7:00 – 11:00 PM"/);
    expect(html.match(/aria-label="Remove /g)).toHaveLength(1);
  });

  it("ignores a selection on a day it isn't showing", () => {
    expect(render(thu)).not.toContain('data-edge');
  });
});

describe('paint modes', () => {
  it('offers Available and If needed only, with no Erase', () => {
    const html = renderToStaticMarkup(<AvailabilityEditor initial={null} />);
    const modes = html.slice(html.indexOf('role="radiogroup"') - 120, html.indexOf('Clear week'));
    expect(modes.match(/role="radio"/g)).toHaveLength(2);
    expect(modes).toContain('grid-cols-2');
    expect(html).not.toMatch(/erase/i);
  });
});
