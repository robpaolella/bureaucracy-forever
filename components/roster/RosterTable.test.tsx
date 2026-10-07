import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RosterTable } from './RosterTable';
import type { RosterRow } from '@/lib/roster';
import { CLASS_COLORS } from '@/lib/design/class-colors';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const main: RosterRow = { id: 'member', name: 'Ledgerline', character: 'Ledgerline', wowClass: 'warrior', spec: 'Protection', role: 'tank', rank: 'officer', attendance: 0.9, joinedAt: '2026-01-01T00:00:00Z', alts: [] };
const alts: RosterRow['alts'] = [
  { id: 'a', name: 'Inkwell', wowClass: 'mage', spec: 'Frost', role: 'ranged' },
  { id: 'b', name: 'Sealwax', wowClass: 'priest', spec: 'Holy', role: 'healer' },
];

describe('roster alt lines', () => {
  it('shows read-only names, class, spec and role in both desktop and phone views', () => {
    const html = renderToStaticMarkup(<RosterTable rows={[{ ...main, alts }, { ...main, id: 'other', name: 'Subclause' }]} />);
    expect(html.match(/aria-label="Alts for Ledgerline"/g)).toHaveLength(2);
    expect(html.match(/Inkwell<\/span> · Mage · Frost · Ranged DPS/g)).toHaveLength(2);
    expect(html.match(/Sealwax<\/span> · Priest · Holy · Healer/g)).toHaveLength(2);
    expect(html).toContain(`color:${CLASS_COLORS.mage.onInk}`);
    expect(html).not.toContain('Alts for Subclause');
    expect(html).not.toContain('Edit Inkwell');
    expect(html).toContain('2 of 2 shown');
  });

  it('omits alt lists for main-only and no-main members', () => {
    const bare = { ...main, id: 'bare', character: null, wowClass: null, spec: null, role: null, alts: [] };
    const html = renderToStaticMarkup(<RosterTable rows={[main, bare]} />);
    expect(html).not.toContain('Alts for');
    expect(html).toContain('No main yet');
  });
});
