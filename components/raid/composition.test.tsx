import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RaidCardRow } from '@/components/calendar/RaidCardRow';
import type { DetailRow } from '@/lib/raid-detail';
import { RaidSummary } from './RaidSummary';
import { RosterByRole } from './RosterByRole';

vi.mock('@/components/time/useViewerTimeZone', () => ({ useViewerTimeZone: () => null }));
vi.mock('./AnswerFor', () => ({ AnswerFor: () => null }));

const stored = { tank: 2, healer: 8, melee: 11, ranged: 14 };
const counts = { tank: 1, healer: 8, melee: 3, ranged: 4 };

describe('composition displays', () => {
  it('the raid summary shows Tank, Healer and DPS', () => {
    const html = renderToStaticMarkup(<RaidSummary counts={counts} requirements={stored} split={{ web: 1, discord: 0 }} notes={null} cancelled={false} status="DONE" locksAt="2030-01-01T00:00:00Z" />);
    expect(html).toContain('Tank');
    expect(html).toContain('Healer');
    expect(html).toContain('DPS');
    expect(html).not.toContain('Melee');
    expect(html).not.toContain('Ranged');
    expect(html).toContain('<span class="text-fg-3"> / 25</span>');
  });

  it('the calendar row shows three role counts with DPS needs summed', () => {
    const html = renderToStaticMarkup(
      <RaidCardRow raid={{ id: 'r', name: 'Onyxia', startsAt: '2030-01-01T20:00:00Z', durationMin: 180, notes: null, cancelled: false, requirements: stored, counts, mine: null }}
        tonight={false} canRespond={false} past={false} now="2029-12-01T00:00:00Z" onRespond={() => {}} />,
    );
    expect(html.match(/<dt /g)).toHaveLength(3);
    expect(html).toContain('7<span class="sr-only"> of 25 needed</span>');
  });

  it('the sign-up list groups Tanks, Healers and DPS', () => {
    const row = (name: string, role: DetailRow['role']): DetailRow => ({ userId: name, name, character: name, wowClass: 'mage', spec: 'Fire', role, standing: 'ROSTER', response: 'accept', attended: null, source: 'web', reason: null, setBy: null, updatedAt: '2030-01-01T00:00:00Z' });
    const html = renderToStaticMarkup(<RosterByRole raidId="r" rows={[row('A', 'melee'), row('B', 'ranged'), row('C', 'tank'), row('D', null)]} now="2030-01-02T00:00:00Z" canAnswerFor={false} showAttendance={false} />);
    const heads = [...html.matchAll(/<h3[^>]*>(.*?)<span/g)].map((m) => m[1]);
    expect(heads).toEqual(['Tank', 'DPS', 'No main set']);
    expect(html).toContain('A</span>');
    expect(html).toContain('Mage');
  });
});
