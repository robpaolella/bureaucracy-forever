'use client';

import { useEffect, useState } from 'react';
import type { LootSection } from '@/content/loot';
import { cn } from '@/lib/cn';

/** A section counts as current once its top has scrolled to within this many px of the viewport top. */
const ACTIVATE_AT = 120;

/**
 * Table of contents. Desktop: a sticky card in the left column. Mobile: a horizontally
 * scrolling chip row pinned under the header (docs/04 § Loot rules). The current section
 * is the last one whose heading has passed the activation line; the first on load.
 */
export function LootToc({ sections }: { sections: LootSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= ACTIVATE_AT) current = s.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav
      aria-label="On this page"
      className="sticky top-0 z-10 -mx-4 bg-ink-950 px-4 py-3 lg:top-6 lg:mx-0 lg:bg-transparent lg:p-0"
    >
      {/* Mobile chip row */}
      <ol className="flex gap-2 overflow-x-auto pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? 'location' : undefined}
              className={cn(
                'flex h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors duration-[120ms]',
                active === s.id ? 'border-teal-dim bg-teal-wash text-fg' : 'border-line-strong bg-ink-850 text-fg-2 hover:text-fg',
              )}
            >
              {s.tocLabel}
            </a>
          </li>
        ))}
      </ol>
      {/* Desktop card */}
      <div className="hidden flex-col gap-1 rounded-card border border-line bg-ink-850 p-[22px] lg:flex">
        <span className="px-2.5 pb-2.5 text-label font-semibold uppercase text-fg-3">On this page</span>
        <ol className="flex flex-col gap-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? 'location' : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-control px-2.5 py-[9px] text-sm transition-colors duration-[120ms]',
                  active === s.id ? 'bg-ink-800 text-fg' : 'text-fg-2 hover:bg-ink-800 hover:text-fg',
                )}
              >
                {s.tocLabel}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
