import Link from 'next/link';
import { DISCLAIMER } from '@/lib/config';
import { FOOTER_LINKS } from '@/lib/nav';
import { Wordmark } from './Wordmark';

/** Wordmark at 16px / 70%, the four public links, and the disclaimer. Every page. */
export function Footer() {
  return (
    <footer className="mt-auto flex flex-col gap-3.5 border-t border-line-faint px-4 py-9 md:flex-row md:items-center md:justify-between md:px-gutter">
      <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:gap-7">
        <Wordmark size="footer" className="opacity-70" />
        {/* 44px hit targets on 13px text: the anchors carry the height, not the type. */}
        <nav className="flex flex-wrap gap-x-[18px] text-[13px]" aria-label="Footer">
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="flex min-h-11 items-center text-fg-2 transition-colors duration-[120ms] hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-xs leading-relaxed text-fg-3">{DISCLAIMER}</p>
    </footer>
  );
}
