import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type EmptyStateProps = {
  title: string;
  /** One sentence: what will fill this, and who fills it. */
  children: ReactNode;
  /** One secondary button, at most. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-ink-850 px-6 py-9 text-center',
        className,
      )}
    >
      <Image src="/brand/mark.png" alt="" width={35} height={40} className="opacity-[0.28]" />
      <span className="text-body font-semibold">{title}</span>
      <span className="max-w-[260px] text-small text-fg-2">{children}</span>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
