import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** wordmark.png is 1000×201. Heights from design-handover/CLAUDE.md § Brand assets. */
const SIZES = {
  header: { height: 22, width: 109 },
  mobile: { height: 18, width: 90 },
  footer: { height: 16, width: 80 },
} as const;

export function Wordmark({ size, className }: { size: keyof typeof SIZES; className?: string }) {
  const { height, width } = SIZES[size];
  return (
    <Link href="/" className={cn('flex min-h-11 shrink-0 items-center', className)} aria-label="Bureaucracy home">
      <Image src="/brand/wordmark.png" alt="Bureaucracy" width={width} height={height} priority={size !== 'footer'} />
    </Link>
  );
}
