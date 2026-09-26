'use client';

import { fmtSlot, type WeekDay } from '@/lib/availability';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import type { HeatCell, HeatmapMember } from '@/lib/heatmap';

export type InspectorTarget = {
  day: number;
  slot: number;
  /** Cell box relative to the grid container, for the popover. */
  box: { top: number; left: number; width: number; height: number };
};

const NAME_CAP = 12;

/** The contents of the hover inspector (docs/05 § Hover inspector), also used as a card on mobile. */
export function InspectorBody({ day, slot, cell, members, memberCount, offsetSlots }: { day: WeekDay; slot: number; cell: HeatCell; members: HeatmapMember[]; memberCount: number; offsetSlots: number }) {
  const shown = cell.who.slice(0, NAME_CAP);
  const more = cell.who.length - shown.length;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-[3px]">
        <span className="tabular text-sm font-semibold">
          {day.name} {fmtSlot(slot)} — your time
        </span>
        <span className="tabular text-[11px] text-fg-3">{fmtSlot(slot + offsetSlots)} guild time</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular text-[28px] font-semibold leading-none text-teal">{cell.total}</span>
        <span className="text-xs text-fg-2">
          of {memberCount} available
          {cell.ifNeeded > 0 && (
            <>
              {' · '}
              <span className="tabular">{cell.ifNeeded}</span> if needed, counted half
            </>
          )}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-fg-2">
        {(
          [
            ['Tanks', cell.roles.tank],
            ['Healers', cell.roles.healer],
            ['Melee', cell.roles.melee],
            ['Ranged', cell.roles.ranged],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="flex gap-1.5">
            <dt>{label}</dt>
            <dd className="tabular font-semibold text-fg">{n}</dd>
          </div>
        ))}
      </dl>
      {cell.who.length > 0 && (
        <>
          <div className="h-px bg-line" aria-hidden />
          <ul className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs" aria-label="Members free in this half-hour">
            {shown.map((w) => {
              const m = members[w.i];
              return (
                <li key={w.i} className={w.state === 'if-needed' ? 'opacity-70' : undefined} style={{ color: m.wowClass ? CLASS_COLORS[m.wowClass].onInk : undefined }}>
                  {m.name}
                  {w.state === 'if-needed' && <span className="text-fg-3"> ?</span>}
                </li>
              );
            })}
            {more > 0 && <li className="text-fg-3">+{more} more</li>}
          </ul>
        </>
      )}
    </div>
  );
}

/** A 260px popover inside the grid, offset from the hovered cell, flipping left past the midpoint. */
export function InspectorPopover({ target, gridHeight, children }: { target: InspectorTarget; gridHeight: number; children: React.ReactNode }) {
  const WIDTH = 260;
  const flip = target.day > 3;
  const left = flip ? target.box.left - WIDTH - 10 : target.box.left + target.box.width + 10;
  const top = Math.max(4, Math.min(target.box.top - 60, gridHeight - 300));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-card border border-line-strong bg-ink-800 px-[18px] py-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      style={{ top, left, width: WIDTH }}
    >
      {children}
    </div>
  );
}
