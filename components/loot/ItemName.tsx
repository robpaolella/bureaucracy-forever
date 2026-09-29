'use client';

import { useId, useRef } from 'react';
import { useDisclosure } from '@/components/shell/useDismiss';
import { cn } from '@/lib/cn';
import { itemQuality } from '@/lib/design/item-quality';
import type { ItemView } from '@/lib/loot-items';
import { iconUrl } from '@/lib/wowhead';

/** Icon plus the name in its quality color. The quality word is there for screen readers. */
export function ItemLabel({ item, size = 'small', className }: { item: Pick<ItemView, 'name' | 'quality' | 'icon'>; size?: 'small' | 'medium'; className?: string }) {
  const quality = itemQuality(item.quality);
  const px = size === 'small' ? 18 : 36;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {/* Wowhead's CDN, not next/image: the icons are tiny and already cached there. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconUrl(item.icon, size)} alt="" width={px} height={px} loading="lazy" className="shrink-0 rounded-tag border border-line-strong" />
      <span className="truncate font-semibold" style={{ color: quality.onInk }}>
        {item.name}
        <span className="sr-only"> ({quality.label})</span>
      </span>
    </span>
  );
}

/**
 * An item that opens its Wowhead tooltip on hover (mouse), click, tap or Enter. The tooltip HTML was
 * sanitized on the server (lib/loot-items.ts toItemView) before it reached this prop.
 */
export function ItemName({ item, size = 'small', className }: { item: ItemView; size?: 'small' | 'medium'; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, toggle, close } = useDisclosure(containerRef, triggerRef);
  const tipId = useId();
  // Hover opens it for a mouse; the click that usually follows should not close it again.
  const hoverOpened = useRef(false);

  return (
    <span ref={containerRef} className={cn('relative inline-flex min-w-0', className)} onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse' || !open) return;
        hoverOpened.current = false;
        close();
      }}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => {
          if (hoverOpened.current) hoverOpened.current = false;
          else toggle();
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse' || open) return;
          hoverOpened.current = true;
          toggle();
        }}
        className="inline-flex min-h-11 min-w-0 items-center rounded-control text-left hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
      >
        <ItemLabel item={item} size={size} />
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={cn('wh-tooltip absolute left-0 top-full z-30 mt-1 w-[300px] max-w-[calc(100vw-32px)] rounded-card border border-line-strong bg-ink-800 p-3 text-[13px] leading-[1.45] text-fg shadow-pop', open ? 'block' : 'hidden')}
        dangerouslySetInnerHTML={{ __html: item.tooltipHtml }}
      />
    </span>
  );
}
