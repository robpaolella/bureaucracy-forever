'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';
import type { HeatmapMember } from '@/lib/heatmap';

const SHOWN = 5;
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** docs/05 § Hasn't submitted: a warn count pill, five rows, then "Show all nine". */
export function NotSubmitted({ members }: { members: HeatmapMember[] }) {
  const [all, setAll] = useState(false);
  const rows = all ? members : members.slice(0, SHOWN);
  const count = members.length;
  const word = WORDS[count] ?? String(count);

  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold">Hasn&apos;t submitted</h3>
        <span className="tabular rounded-full border border-warn-line bg-warn-wash px-2.5 py-[3px] text-[11px] font-bold text-warn">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-small text-fg-2">Everyone on the roster has painted a week.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((m) => (
            <li key={m.name} className="flex items-center justify-between border-b border-line-faint py-[9px] last:border-b-0">
              <span className="text-sm font-semibold" style={{ color: m.wowClass ? CLASS_COLORS[m.wowClass].onInk : undefined }}>
                {m.name}
              </span>
              <span className="text-xs text-fg-3">
                {m.wowClass ? CLASS_COLORS[m.wowClass].label : 'No main yet'} · {ROLE_LABELS[m.role]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {count > SHOWN && (
        <Button variant="secondary" size="md" className="w-full" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show all ${word}`}
        </Button>
      )}
    </Card>
  );
}
