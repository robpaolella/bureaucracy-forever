/**
 * Class needs. The single source of truth for the recruitment table, the home-page
 * teaser and (later) the Discord bot's /recruiting reply. PLACEHOLDER statuses per
 * design-handover/CLAUDE.md; officers will edit these once the data layer exists.
 */
import { CLASS_COLORS, type Role, type WowClass } from '@/lib/design/class-colors';

export type NeedStatus = 'high' | 'medium' | 'closed';

export type ClassNeed = {
  wowClass: WowClass;
  spec: string;
  role: Role;
  status: NeedStatus;
};

export const NEED_LABEL: Record<NeedStatus, string> = {
  high: 'High need',
  medium: 'Medium',
  closed: 'Closed',
};

export const CLASS_NEEDS: ClassNeed[] = [
  { wowClass: 'priest', spec: 'Holy', role: 'healer', status: 'high' },
  { wowClass: 'priest', spec: 'Shadow', role: 'ranged', status: 'high' },
  { wowClass: 'warrior', spec: 'Protection', role: 'tank', status: 'high' },
  { wowClass: 'warrior', spec: 'Fury', role: 'melee', status: 'closed' },
  { wowClass: 'warlock', spec: 'Destruction', role: 'ranged', status: 'medium' },
  { wowClass: 'druid', spec: 'Restoration', role: 'healer', status: 'medium' },
  { wowClass: 'druid', spec: 'Feral', role: 'tank', status: 'closed' },
  { wowClass: 'mage', spec: 'Frost', role: 'ranged', status: 'closed' },
  { wowClass: 'rogue', spec: 'Combat', role: 'melee', status: 'closed' },
  { wowClass: 'hunter', spec: 'Marksmanship', role: 'ranged', status: 'closed' },
  { wowClass: 'paladin', spec: 'Holy', role: 'healer', status: 'closed' },
  { wowClass: 'shaman', spec: 'Restoration', role: 'healer', status: 'closed' },
];

export type TeaserCard = { wowClass: WowClass; label: string; specs: string[]; status: NeedStatus };

const RANK: Record<NeedStatus, number> = { high: 0, medium: 1, closed: 2 };

/**
 * Home-page teaser: one card per class with an open need, specs joined, showing the
 * most urgent status. Capped to `limit`, most urgent first.
 */
export function teaserNeeds(needs: ClassNeed[] = CLASS_NEEDS, limit = 4): TeaserCard[] {
  const byClass = new Map<WowClass, TeaserCard>();
  for (const n of needs) {
    if (n.status === 'closed') continue;
    const card = byClass.get(n.wowClass) ?? {
      wowClass: n.wowClass,
      label: CLASS_COLORS[n.wowClass].label,
      specs: [],
      status: n.status,
    };
    card.specs.push(n.spec);
    if (RANK[n.status] < RANK[card.status]) card.status = n.status;
    byClass.set(n.wowClass, card);
  }
  return [...byClass.values()].sort((a, b) => RANK[a.status] - RANK[b.status]).slice(0, limit);
}
