import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyPaintRun, dayBlocks, weekDays, type Block, type Week } from '@/lib/availability';
import { WeekGrid } from './WeekGrid';

const zone = 'America/New_York';
const days = weekDays(new Date('2026-10-06T12:00:00Z'), zone);
/** The approved typical Tuesday: 7:00–11:00 PM available, then if needed to midnight; Thu 6:30 PM. */
const week: Week = {
  ...applyPaintRun({}, 1, 38, 45, 'available'),
  ...applyPaintRun({}, 1, 46, 47, 'if-needed'),
  '3:37': 'if-needed',
};
const [tue] = dayBlocks(week, 1);

const render = (selected: Block | null) =>
  renderToStaticMarkup(
    <WeekGrid week={week} days={days} offsetSlots={0} zone={zone} slotAt={() => '2026-10-05T04:00:00.000Z'} mode="available" onWeek={() => {}} selected={selected} onSelect={() => {}} onOpenDay={() => {}} />,
  );

describe('WeekGrid blocks', () => {
  it('draws each run once, with its range, state word and screen-reader name', () => {
    const html = render(null);
    const text = html.replace(/<!-- -->|<[^>]+>/g, '');
    expect(html.match(/role="listitem"/g)).toHaveLength(3);
    expect(text).toContain('7:00 – 11:00 PMAvailable');
    expect(text).toContain('11:00 PM – 12:00 AMIf needed');
    expect(text).toContain('6:30 – 7:00 PMIf needed');
    expect(html).toContain('Available, Tuesday 7:00 PM to 11:00 PM');
    expect(html).toContain('If needed, Thursday 6:30 PM to 7:00 PM');
    // No per-cell buttons and no Tab stops in the body: the day headers are the keyboard route.
    expect(html).not.toContain('data-key');
  });

  it('shows × only on the selected block, labelled for screen readers and out of the tab order', () => {
    expect(render(null)).not.toContain('Remove available');
    const html = render(tue);
    expect(html).toMatch(/<button[^>]*tabindex="-1"[^>]*aria-label="Remove available 7:00 – 11:00 PM"/);
    expect(html.match(/aria-label="Remove /g)).toHaveLength(1);
  });

  it('keeps the day headers as the route to the day list', () => {
    expect(render(null)).toContain('aria-label="Tuesday 6 Oct: set hours from a list"');
  });
});
