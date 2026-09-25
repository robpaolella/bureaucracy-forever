import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Join class names and resolve Tailwind conflicts so a trailing `className` really
 * overrides a base class. Plain concatenation does not: Tailwind orders utilities by
 * its own group order, so `h-[22px] h-[19px]` kept 22px. The custom scale from
 * tailwind.config.ts is declared here so `text-label` is a font size, not a colour.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['gutter', 'section'],
    },
    classGroups: {
      'font-size': [
        { text: ['display-xl', 'display-l', 'display-m', 'title', 'body-l', 'body', 'small', 'label', 'eyebrow'] },
      ],
    },
  },
});

export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
