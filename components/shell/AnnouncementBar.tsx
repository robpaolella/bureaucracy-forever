import Link from 'next/link';
import { ANNOUNCEMENT } from '@/content/home';

/** 40px teal-wash launch line above the header. Home only. Wraps to two lines on mobile. */
export function AnnouncementBar() {
  return (
    <div className="flex min-h-10 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-teal-line bg-teal-wash px-4 py-2 text-center text-[13px] text-teal-text md:py-0">
      <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.24em] text-teal">{ANNOUNCEMENT.eyebrow}</span>
      <span>{ANNOUNCEMENT.text}</span>
      {/* 44px hit box inside a 40px bar: the negative margin keeps the bar height. */}
      <Link href={ANNOUNCEMENT.href} className="-my-0.5 flex min-h-11 items-center font-semibold text-teal transition-[filter] duration-[120ms] hover:brightness-110">
        {ANNOUNCEMENT.linkLabel}
      </Link>
    </div>
  );
}
