import type { Config } from 'tailwindcss';

/**
 * Merge into the repo's tailwind.config.ts. Values point at the custom properties
 * in design/tokens.css so there is exactly one place to change a color.
 *
 * Rule for the build: no arbitrary hex in JSX. If a value isn't here, it either
 * belongs here or it's wrong.
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: 'var(--ink-950)',
          900: 'var(--ink-900)',
          850: 'var(--ink-850)',
          800: 'var(--ink-800)',
          700: 'var(--ink-700)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
          faint: 'var(--line-faint)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          2: 'var(--fg-2)',
          3: 'var(--fg-3)',
          muted: 'var(--fg-muted)', // added: see globals.css
        },
        sand: {
          DEFAULT: 'var(--sand)',
          dim: 'var(--sand-dim)',
          wash: 'var(--sand-wash)',
        },
        teal: {
          DEFAULT: 'var(--teal)',
          dim: 'var(--teal-dim)',
          wash: 'var(--teal-wash)',
          line: 'var(--teal-line)',
        },
        ok:   { DEFAULT: 'var(--ok)',   wash: 'var(--ok-wash)',   line: 'var(--ok-line)' },
        warn: { DEFAULT: 'var(--warn)', wash: 'var(--warn-wash)', line: 'var(--warn-line)' },
        stop: { DEFAULT: 'var(--stop)', wash: 'var(--stop-wash)', line: 'var(--stop-line)' },
        slot: {
          empty: 'var(--slot-empty)',
          available: 'var(--slot-available)',
          ifNeeded: 'var(--slot-if-needed)',
        },
        heat: {
          0: 'var(--heat-0)', 1: 'var(--heat-1)', 2: 'var(--heat-2)',
          3: 'var(--heat-3)', 4: 'var(--heat-4)', 5: 'var(--heat-5)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        eyebrow: ['var(--font-eyebrow)'],
        sans: ['var(--font-ui)'],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing }] — the scale from docs/01
        'display-xl': ['4rem',    { lineHeight: '1.04', letterSpacing: '-0.02em' }],   // 64
        'display-l':  ['2.75rem', { lineHeight: '1.1',  letterSpacing: '-0.015em' }],  // 44
        'display-m':  ['1.875rem',{ lineHeight: '1.2' }],                              // 30
        'title':      ['1.25rem', { lineHeight: '1.3' }],                              // 20
        'body-l':     ['1.0625rem',{ lineHeight: '1.7' }],                             // 17
        'body':       ['1rem',    { lineHeight: '1.65' }],                             // 16
        'small':      ['0.8125rem',{ lineHeight: '1.55' }],                            // 13
        'label':      ['0.6875rem',{ lineHeight: '1.2', letterSpacing: '0.14em' }],    // 11
        'eyebrow':    ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.3em' }],      // 12
      },
      borderRadius: {
        tag: 'var(--r-tag)',
        control: 'var(--r-control)',
        card: 'var(--r-card)',
        modal: 'var(--r-modal)',
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
        modal: 'var(--shadow-modal)',
      },
      spacing: {
        // Page rhythm. Everything else comes from Tailwind's 4px scale.
        gutter: '6rem',   // 96 — desktop page gutter
        section: '4.5rem',// 72 — gap between page sections
      },
      maxWidth: {
        prose: '42.5rem', // 680 — the widest a paragraph gets
        content: '75rem', // 1200 — content column inside a 1440 page
      },
    },
  },
} satisfies Config;
