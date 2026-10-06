'use client';

import { Fragment } from 'react';
import { blockLabel, blockRange, blockRemoveLabel, SLOTS, STATE_WORD, type Block } from '@/lib/availability';
import { cn } from '@/lib/cn';

export const ROW = 19;

export const FILL: Record<Block['state'], string> = {
  available: 'bg-slot-available',
  'if-needed': 'bg-slot-ifNeeded',
};

const RING = 'ring-2 ring-teal ring-offset-2 ring-offset-ink-900';

type Props = {
  block: Block;
  selected: boolean;
  /** The edge being dragged, when this block is mid-resize. */
  resizing: 'start' | 'end' | null;
  /** False while any stroke or resize is under way, so blocks the pointer crosses stay quiet. */
  idle: boolean;
  onRemove: () => void;
};

function Dots() {
  return (
    <i className="flex h-[9px] w-6 items-center justify-center gap-[3px] rounded-full border border-line-strong bg-ink-950">
      {[0, 1, 2].map((n) => (
        <b key={n} className="h-[3px] w-[3px] rounded-full bg-fg" />
      ))}
    </i>
  );
}

/**
 * One painted run in the desktop grid (design/158-availability-blocks, version A): a rounded
 * block with its range at the top and the state word below; one line for a half-hour. Hover
 * shows a 1px inner ring and dot handles (44×20, the accepted pointer exception); selected
 * adds the teal outline and ×. Handle hit areas lean outward from their edge, inside the
 * block at the day's ends, while the dots stay centred on the edge.
 */
export function WeekBlock({ block, selected, resizing, idle, onRemove }: Props) {
  const one = block.end - block.start === 1;
  const height = (block.end - block.start) * ROW - 2;
  const controls = selected || resizing !== null;
  const tagTop = resizing === 'start' ? (block.start <= 1 ? 8 : -30) : Math.max(8, height - 34);

  return (
    <div
      role="listitem"
      data-start={block.start}
      className={cn(
        'group absolute inset-x-[3px] cursor-pointer rounded text-[11px] leading-[13px] text-white transition-shadow duration-[120ms]',
        FILL[block.state],
        resizing ? `z-[4] ${RING}` : selected ? `z-[3] ${RING}` : idle && 'hover:ring-1 hover:ring-inset hover:ring-white/60',
      )}
      style={{ top: block.start * ROW + 1, height }}
    >
      <span className="sr-only">{blockLabel(block)}</span>
      {/* The range matters most: on a narrow column a one-line block gives up the state word
          first, and a taller block wraps its range, clipping at its own bottom edge. */}
      <div
        aria-hidden
        className={cn(
          'tabular pointer-events-none absolute left-[7px]',
          one && selected && !resizing ? 'right-7' : 'right-[7px]',
          one ? 'top-1/2 flex -translate-y-1/2 justify-between gap-1.5 whitespace-nowrap' : 'bottom-0.5 top-1.5 overflow-hidden',
        )}
      >
        {/* A taller selected block keeps only its first line clear of the ×. */}
        {!one && selected && !resizing && <span className="float-right h-4 w-5" />}
        <div className={cn('font-semibold', one && 'min-w-0 truncate')}>
          {/* Wrap only at the dash, never inside a time. */}
          {blockRange(block)
            .split(' – ')
            .map((part, i, parts) => (
              <Fragment key={i}>
                <span className="inline-block max-w-full truncate align-top">{i < parts.length - 1 ? `${part} –` : part}</span>
                {i < parts.length - 1 && ' '}
              </Fragment>
            ))}
        </div>
        <div className={cn('truncate', one && 'min-w-0 shrink-[8]')}>{STATE_WORD[block.state]}</div>
      </div>

      {(['start', 'end'] as const).map((edge) => (
        <span
          key={edge}
          data-edge={edge}
          aria-hidden
          className={cn(
            'absolute left-1/2 z-[5] h-5 w-11 -translate-x-1/2 cursor-ns-resize justify-center',
            controls ? 'flex' : idle ? 'hidden group-hover:flex' : 'hidden',
            edge === 'start'
              ? block.start === 0
                ? 'top-0 -translate-y-1/4 items-start pt-[0.5px]'
                : 'top-0 -translate-y-[70%] items-end pb-[1.5px]'
              : block.end === SLOTS
                ? 'top-full -translate-y-3/4 items-end pb-[5px]'
                : 'top-full -translate-y-[30%] items-start pt-[1.5px]',
          )}
        >
          <Dots />
        </span>
      ))}

      {selected && !resizing && (
        <button
          type="button"
          // Blocks are not Tab stops; the day header's list is the keyboard route. The
          // ::after hit area is 44×44 measured from inside the 1px border.
          tabIndex={-1}
          aria-label={blockRemoveLabel(block)}
          onClick={onRemove}
          className={cn(
            'absolute right-0.5 z-[6] flex items-center justify-center rounded-full border border-line-strong bg-ink-800 p-0 text-fg transition-colors duration-[120ms] after:absolute after:content-[""] hover:bg-ink-700',
            one ? 'top-1/2 h-4 w-4 -translate-y-1/2 after:-inset-[15px]' : 'top-0.5 h-5 w-5 after:-inset-[13px]',
          )}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </button>
      )}

      {resizing && (
        <div
          aria-hidden
          className="tabular pointer-events-none absolute left-1/2 z-[7] -translate-x-1/2 whitespace-nowrap rounded-control border border-teal-line bg-ink-950 px-[9px] py-1 text-xs font-semibold leading-4 text-fg shadow-pop"
          style={{ top: tagTop }}
        >
          {blockRange(block)}
        </div>
      )}
    </div>
  );
}
