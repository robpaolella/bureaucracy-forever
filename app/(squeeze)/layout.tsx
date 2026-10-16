import type { ReactNode } from 'react';
import { Wordmark } from '@/components/shell/Wordmark';

/**
 * The squeeze page (approved design 341): a logo-only top bar and one centred card, with no
 * site nav or footer. A separate group from (site), so its pages never render the shell.
 */
export default function SqueezeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[60px] items-center px-4 md:h-[72px] md:px-gutter">
        <Wordmark size="header" />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
