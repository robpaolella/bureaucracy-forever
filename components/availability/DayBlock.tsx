'use client';

import { blockLabel, blockRange, blockRemoveLabel, SLOTS, STATE_WORD, type Block } from '@/lib/availability';
import { cn } from '@/lib/cn';
import { Dots, FILL, RING, TAG } from './WeekBlock';

export const ROW = 34;

type Props = {
  block: Block;
  selected: boolean;
  /** The edge being dragged, when this block is mid-resize. */
  resizing: 'start' | 'end' | null;
  onRemove: () => void;
};

/**
 * One painted run in the phone day column (design/158-availability-blocks, version A): the
 * desktop block at the phone's size, with no hover. Tapped, it gains the teal outline,
 * finger-sized handles (56×44) and a × with a 44×44 hit area. Its range and × sit in a
 * sticky head, so a long block scrolled past its top keeps them in view.
 */
export function DayBlock({ block, selected, resizing, onRemove }: Props) {
  const one = block.end - block.start === 1;
  const height = (block.end - block.start) * ROW - 2;
  const tagTop = resizing === 'start' ? (block.start <= 1 ? 8 : -30) : Math.max(8, height - 34);
  const showX = selected && !resizing;

  return (
    <div
      role="listitem"
      data-start={block.start}
      className={cn('absolute inset-x-1.5 rounded text-xs leading-[15px] text-white transition-shadow duration-[120ms]', FILL[block.state], resizing ? `z-[4] ${RING}` : selected && `z-[3] ${RING}`)}
      style={{ top: block.start * ROW + 1, height }}
    >
      <span className="sr-only">{blockLabel(block)}</span>
      <div className={cn('sticky top-0 z-[2]', one ? 'h-full' : 'h-0')}>
        <div
          aria-hidden
          className={cn(
            'tabular pointer-events-none absolute left-2.5 whitespace-nowrap',
            showX ? 'right-10' : 'right-2.5',
            one ? 'top-1/2 flex -translate-y-1/2 justify-between gap-1.5' : 'top-[9px]',
          )}
        >
          <div className="truncate font-semibold">{blockRange(block)}</div>
          <div className="truncate">{STATE_WORD[block.state]}</div>
        </div>
        {showX && (
          <button
            type="button"
            // Blocks are not Tab stops; the day switcher's list is the keyboard route.
            tabIndex={-1}
            aria-label={blockRemoveLabel(block)}
            onClick={onRemove}
            className={cn(
              'absolute right-[3px] flex items-center justify-center rounded-full border border-line-strong bg-ink-800 p-0 text-fg after:absolute after:content-[""]',
              one ? 'top-1/2 h-[26px] w-[26px] -translate-y-1/2 after:-inset-[9px]' : 'top-[3px] h-7 w-7 after:-inset-2',
            )}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="M2 2l6 6M8 2l-6 6" />
            </svg>
          </button>
        )}
      </div>

      {(selected || resizing) &&
        (['start', 'end'] as const).map((edge) => (
          <span
            key={edge}
            data-edge={edge}
            aria-hidden
            // Hit areas lean outward from their edge (inside the block at the day's ends), so a
            // half-hour block's two never overlap; the dots stay centred on the edge.
            className={cn(
              'absolute left-1/2 z-[5] flex h-11 w-14 -translate-x-1/2 justify-center [touch-action:none]',
              edge === 'start'
                ? block.start === 0
                  ? 'top-0 -translate-y-[20%] items-start pt-[9px]'
                  : 'top-0 -translate-y-[68%] items-end pb-2'
                : block.end === SLOTS
                  ? 'top-full -translate-y-[80%] items-end pb-[9px]'
                  : 'top-full -translate-y-[32%] items-start pt-2',
            )}
          >
            <Dots large />
          </span>
        ))}

      {resizing && (
        <div aria-hidden className={TAG} style={{ top: tagTop }}>
          {blockRange(block)}
        </div>
      )}
    </div>
  );
}
