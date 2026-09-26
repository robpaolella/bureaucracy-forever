import Image from 'next/image';
import type { ReactNode } from 'react';

type Props = { eyebrow: string; title: string; body: string; actions: ReactNode };

/** The centred column the submitted, not-found and error pages share (docs/04 § Application submitted sets the pattern). */
export function StatusPage({ eyebrow, title, body, actions }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-6 px-4 pb-24 pt-20 text-center md:pt-[120px]">
      <Image src="/brand/mark.png" alt="" width={42} height={48} className="w-10 opacity-40 md:w-12" />
      <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{eyebrow}</span>
      <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{title}</h1>
      <p className="text-[15px] leading-[1.7] text-fg-2">{body}</p>
      <div className="flex flex-col gap-3 sm:flex-row">{actions}</div>
    </div>
  );
}
