import { cn } from '@/lib/cn';
import { CLASS_COLORS, type WowClass } from '@/lib/design/class-colors';
import { initials } from '@/lib/format';

type Props = {
  name: string;
  /** Colours the initials and the ring. Undefined until the roster knows the main. */
  wowClass?: WowClass | null;
  size?: 24 | 28 | 32;
  className?: string;
};

/**
 * A round initial avatar in the member's class colour (docs/04 § Raid detail: a 24px
 * class-coloured initial avatar on every sign-up row). Decorative: the name always sits
 * beside it, so the avatar itself is hidden from assistive tech.
 */
export function ClassAvatar({ name, wowClass, size = 24, className }: Props) {
  const color = wowClass ? CLASS_COLORS[wowClass].onInk : undefined;
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-ink-700 font-bold', size === 24 ? 'text-[10px]' : size === 28 ? 'text-xs' : 'text-[13px]', className)}
      style={{ width: size, height: size, color }}
    >
      {initials(name)}
    </span>
  );
}
