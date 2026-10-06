---
name: Bureaucracy — The Guild Standard
description: Dark, restrained and editorial; serif headlines over compact, bordered guild tools.
colors:
  ink-950: "#06080B"
  ink-900: "#0A0D12"
  ink-850: "#0E1219"
  ink-800: "#141922"
  ink-700: "#1B222E"
  line: "#232B38"
  line-strong: "#323C4C"
  line-faint: "#141922"
  line-hairline: "#0D1117"
  fg: "#E8EDF7"
  fg-2: "#A3AFC2"
  fg-3: "#6F7C90"
  fg-muted: "#8D97A8"
  sand: "#E4C08A"
  sand-dim: "#8A7350"
  sand-wash: "#241E14"
  teal: "#6FC8DC"
  teal-dim: "#2A6B7C"
  teal-wash: "#0E2830"
  teal-line: "#1B4450"
  teal-text: "#A8DCE8"
  ok: "#79D0A0"
  ok-wash: "#12251C"
  ok-line: "#2E5C44"
  warn: "#E9B872"
  warn-wash: "#241E14"
  warn-line: "#6B5530"
  stop: "#E08A8A"
  stop-wash: "#241416"
  stop-line: "#5A3434"
  slot-empty: "#10151C"
  slot-available: "#2E7B58"
  slot-if-needed: "#6B5530"
  heat-0: "#10151C"
  heat-1: "#12303A"
  heat-2: "#17495A"
  heat-3: "#1E6A80"
  heat-4: "#2A8FA8"
  heat-5: "#4FB6CE"
typography:
  display-home:
    fontFamily: 'Newsreader, Georgia, "Times New Roman", serif'
    fontSize: "84px"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.028em"
  display-home-mobile:
    fontFamily: 'Newsreader, Georgia, "Times New Roman", serif'
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.028em"
  headline-public:
    fontFamily: 'Newsreader, Georgia, "Times New Roman", serif'
    fontSize: "60px"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  headline-section:
    fontFamily: 'Newsreader, Georgia, "Times New Roman", serif'
    fontSize: "38px"
    fontWeight: 500
    lineHeight: 1.1
  body:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    lineHeight: 1.2
    letterSpacing: "0.14em"
  label-field:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.08em"
  eyebrow-section:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.28em"
rounded:
  tag: "2px"
  control: "4px"
  card: "8px"
  modal: "14px"
spacing:
  gutter: "96px"
  gutter-mobile: "16px"
  section: "72px"
  card-md: "24px"
  card-lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.control}"
    padding: "0px 22px"
    height: "44px"
  button-secondary:
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "0px 22px"
    height: "44px"
  button-ghost:
    textColor: "{colors.fg-2}"
    rounded: "{rounded.control}"
    padding: "0px 22px"
    height: "44px"
  button-danger:
    textColor: "{colors.stop}"
    rounded: "{rounded.control}"
    padding: "0px 22px"
    height: "44px"
  input:
    backgroundColor: "{colors.ink-700}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "0px 14px"
    height: "46px"
  card:
    backgroundColor: "{colors.ink-850}"
    rounded: "{rounded.card}"
    padding: "24px"
  tag:
    backgroundColor: "{colors.ink-700}"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.tag}"
    padding: "5px 10px"
  status-ok:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok}"
    padding: "5px 11px"
  nav-active:
    textColor: "{colors.fg}"
    height: "72px"
---

# Design System: Bureaucracy

## Overview

**Creative North Star: "The Guild Standard"**

The live site is the design source of truth; `design-handover/` is background, not authority over the implemented site.

Dark, restrained and editorial: serif headlines over compact, bordered tools; sand for emphasis, teal for interaction. The Guild Standard names both a guild banner and the standards the guild holds. It describes the existing world, not a redesign or a new theme.

Public pages give headlines and guild identity room; operational areas use denser tables, labelled states and direct controls. Preserve the distinction rather than applying marketing-page density to a roster or turning every public section into a dashboard.

**Key Characteristics:**
- Ink grounds and Ice text, with Sand and Teal in distinct roles.
- Newsreader headlines, Cinzel eyebrows, Archivo controls and prose.
- Thin borders and tonal surfaces; tight corners on tools.
- Restrained state changes, explicit labels, and guild identity assets.

Evidence: extracted from `app/tokens.css`, `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`, public routes, and shared components on 2026-10-03. Live public pages were inspected at 1440 and 390 widths; shared signed-in patterns are code-derived, not authenticated production verification. [The differences inventory](https://github.com/robpaolella/bureaucracy-forever/issues/76#issuecomment-5974134865) separates those evidence levels. `PRODUCT.md` owns approved claims and commitments, including corrections not yet reflected in live copy.

## Colors

Sand / Ice / Ink / Teal are Robert's approved descriptive names; token keys retain the implementation's names. Frontmatter carries the exact values, not a replacement palette.

### Primary
- **Sand** (`sand`): primary buttons, accolades, officer emphasis, eyebrows and guild-time emphasis. `sand-dim` frames subdued accolade surfaces; `sand-wash` provides the tinted fill where implemented (for example a featured recruitment card).

### Secondary
- **Teal** (`teal`): links, focus and selected/interactive cues. `teal-wash` and `teal-line` frame informational panels; `teal-text` is the readable text treatment on that wash. `teal-dim` supplies subdued borders.

### Neutral
- **Ink**: `ink-950` page ground; `ink-900` table bodies; `ink-850` cards; `ink-800` raised/hover surfaces and generic dialogs; `ink-700` input fills.
- **Ice** (`fg`) is the primary text. `fg-2` is secondary copy; `fg-3` is captions and low-emphasis labels; `fg-muted` is the intermediate grey used by closed/web badges.
- `line` frames cards; `line-strong` frames controls/popovers; `line-faint` divides sections/rows; `line-hairline` marks half-hour grid separators.

Status colors (`ok`, `warn`, `stop`) have matching wash and line tokens. Closed status is neutral. Availability uses `slot-*`; the officer heatmap uses the existing sequential `heat-0` through `heat-5` ramp, not categorical rainbow colors. Class and loot-quality colors remain in `lib/design/class-colors.ts` and `lib/design/item-quality.ts`; they are domain-specific text exceptions, not extra brand accents.

**The Labelled State Rule.** Status color accompanies a word; it never replaces one. These recorded colors do not establish contrast compliance on every possible surface—test the actual pairing against PRODUCT.md's requirements.

## Typography

**Display Font:** Newsreader, with Georgia / Times New Roman / serif fallbacks. **Body Font:** Archivo, with system-ui / -apple-system / sans-serif fallbacks. **Eyebrow Font:** Cinzel, with Georgia / serif fallbacks. `next/font` loads them in `app/layout.tsx` with swap behavior and adds generated metric-adjusted fallback names; the frontmatter records stable family names, not generated identifiers.

Newsreader carries claims and section headings; Cinzel echoes the column mark in uppercase eyebrows; Archivo carries the tools. This is a role pairing, not a universal rule that every heading uses the same size.

### Hierarchy
- Home display uses `display-home` at desktop and `display-home-mobile` below the medium breakpoint. The lede is 19px/1.6 desktop and 17px/1.6 mobile, capped at 620px (`app/(home)/page.tsx`).
- Public page heads use `headline-public` on About/Schedule/Recruitment, dropping to 40px on mobile with the same line-height/tracking.
- `SectionHead` uses `headline-section` desktop / 30px mobile. Its large variant uses 42px / 32px, both at 1.1 line-height. Section eyebrows use `eyebrow-section`; hero/page eyebrows instead use 12px, 1.2 line-height, .32em tracking.
- The configured Tailwind display scale is separately 64px/1.04/−.02em, 44px/1.1/−.015em, and 30px/1.2. Do not substitute it for the observed component roles above.
- Configured title type is 20px/1.3; body-large is 17px/1.7. `body`, `small`, and `label` are the configured utility roles. The bare browser body is 16px/1.5 after Tailwind's base reset; paragraphs explicitly choose their own line-height.
- Field labels use `label-field`, not the generic `label`: uppercase, secondary text. Field hints are 12px; table headers are 11px with .12em tracking; rank badges use .1em tracking. Do not flatten these into one caption rule.
- Counts, times and numeric table values use tabular numerals. Large StatCard figures are Newsreader 500 at 40px with a 1 line-height.

## Layout

The shell is full-width: `SiteShell.tsx` does not impose a global content cap. Public page sections use `gutter` from 768px upward and `gutter-mobile` below it. At 1440px this leaves 1248px inside the side padding. Although Tailwind defines a 1200px content maximum, do not describe it as a globally applied wrapper. Paragraph-specific caps and grid columns are set by each page.

Flex/grid gaps organize groups. The base spacing vocabulary is Tailwind's 4px scale, but current controls intentionally include 10px gaps, 14px input padding and 22px button padding. `section` is a named rhythm token, not the only section gap; the home page also uses 64px, 88px and 96px vertical spacing.

The medium breakpoint (768px) switches the main header and page gutters; large (1024px) enables major side-by-side public layouts and hero watermark. Small (640px) enables selected two-column field/card layouts. Preserve each component's actual breakpoint rather than guessing from “desktop”.

At 390px: public sections stack, home recruitment remains two columns, and the hero watermark disappears. Tables have page-owned mobile card presentations where implemented; the shared DataTable only provides horizontal overflow, not an automatic card conversion. Availability uses a one-day mobile editing view rather than shrinking seven paint columns.

## Elevation & Depth

Layered, not lifted: ink surfaces and thin borders establish depth; shadows are reserved for floating UI such as dialogs, menus and toasts. Resting cards have no drop shadow.

### Shadow Vocabulary
- `shadow-pop`: `0 24px 48px rgba(0, 0, 0, 0.6)` for popovers and toasts.
- `shadow-modal`: `0 24px 48px rgba(0, 0, 0, 0.7)` for dialogs.
- Dialog backdrop: `rgb(6 8 11 / 0.72)`, defined in `app/globals.css`.

These extensions, transitions and breakpoints are also recorded in `.impeccable/design.json`, not invented frontmatter groups. Its color preview ramps are derived OKLCH lightness samples, not additional implemented tokens or approved palettes; only the heatmap ramp reproduces the existing six steps. Component snippets preview the existing primitives without application behavior. No live-mode config or hooks are needed for this documentation.

## Shapes

Tight corners anchor the tool surfaces: `tag`, `control`, `card`, and `modal` correspond to the implemented radius tokens. Circular avatars, status/count pills, toggles and tracks use Tailwind's fully rounded treatment; not every component is rectangular. Native application dialogs intentionally use the card radius rather than the generic modal radius.

Borders are usually 1px. Selected header links use a 2px Sand bottom border. The guild column mark and wordmark, not new ornamental glyphs, carry the identity. Home's contour illustration is inline SVG with Teal strokes at 13% opacity and Sand at 10%; the large column watermark is 5.5% opacity. These are existing hero treatments, not a requirement to decorate every page.

## Components

Restrained and precise: compact tools, firm borders, tight corners, and clear labelled states. Reuse `components/ui/` and the existing feature patterns before introducing another kind of element.

### Buttons and links
- `Button.tsx`: primary Sand/Ink; secondary transparent with a strong border and Ice text; ghost secondary text; danger Stop text and Stop-line border. Frontmatter records the medium variant. Small secondary buttons additionally use the input fill unless their caller overrides it.
- Large buttons are 52px high, 28px horizontal padding, 15px text. Medium buttons use 14px text; small buttons remain 44px high with 16px padding and 13px text. Icon-only controls are 44×44 and require a label.
- Hover is brightness 1.1, transitioning filter over 120ms. Disabled replaces the variant with input-fill/caption text; loading disables interaction, uses .75 opacity and a 13px spinner.
- `TextLink` is Teal with a subdued Teal underline and 2px bottom padding. Section `AccentLink` is a separate 44px-minimum-height pattern without that border; do not conflate them.
- Global keyboard focus is a 2px Teal outline with 2px offset (`app/tokens.css`).

### Cards and badges
- `Card.tsx`: card ground, Line border, medium/large padding. Accolade changes the border to Sand-dim; optional hover raises the ground to Ink-800 over 120ms.
- `Tag` is a compact neutral chip, not an action. `StatusPill` has a colored dot and a word, a matching wash/line, and full rounding. Officer rank uses Sand; other ranks are neutral. `SourceBadge` explicitly labels web versus Discord.

### Inputs and fields
- `Field.tsx`: labelled input at 46px high, 15px text, input fill, strong border and control corners. Textareas use the same surface with 14px horizontal / 12px vertical padding.
- Invalid state uses a Stop border over Stop-wash, plus Stop error text. The error replaces the hint and is associated through `aria-describedby`; `aria-invalid` is set.
- Read-only Discord inputs use raised fill, Line border and caption text. Do not substitute disabled semantics for read-only values. Focus uses the global Teal outline.

### Navigation
- Desktop header row is 72px; mobile row is 60px. Header links are Archivo 14px/500, secondary by default, Ice on hover/active; active includes the Sand underline.
- At the medium breakpoint the drawer replaces the public link row. Mobile retains the wordmark, compact Discord action and menu trigger. Signed-in Members/Officers groups add access-specific links rather than replacing the public navigation.
- Menus use raised surfaces, strong borders and popover shadows. Selected menu/drawer links use Teal-wash; the officer group uses Sand emphasis.

### Dialogs and operational surfaces
- Generic `Modal` uses raised fill, strong border, modal corners and a 22px Newsreader title. Its frame stays whole while the body scrolls; native dialog behavior supplies focus containment and Escape handling.
- Application dialogs are a separate pattern: card fill, Line border, card corners, modal shadow; max 520px for the sign-in/join gate and 880px for the form. Their width leaves 16px on each side on narrow screens. Keep this distinction rather than silently standardizing it away.
- `DataTable` uses 44px comfortable / 36px compact cells, Ink-850 headers/even rows and hover, faint separators, right-aligned tabular numeric cells, and Teal sort arrows. Compact cell height is not blanket permission for undersized controls.
- Availability and heatmap grids use their own slot/ramp tokens and labelled guild/local time gutters. Paint cells are the confirmed target-size exception; preserve the keyboard alternative.

State transitions are commonly 120ms with Tailwind's default `cubic-bezier(0.4, 0, 0.2, 1)`. Progress width and disclosure arrows also transition. Loading includes the button spinner and the skeleton's 1.6s ease-in-out opacity pulse (.35 → .7). There is no evidence for adding entrance or scroll effects. This documents existing motion, not a reduced-motion compliance claim.

## Do's and Don'ts

### Do:
- **Do** use implemented tokens and component variants; compare affected surfaces at 1440 and 390 widths.
- **Do** preserve Sand emphasis, Teal interaction and visible keyboard focus.
- **Do** label states and times: the viewer's local time with its zone, guild time on hover, tap or focus (officer scheduling forms show both side by side); follow PRODUCT.md's confirmed accessibility requirements.
- **Do** distinguish approved product claims from live copy awaiting correction.

### Don't:
- **Don't** restore handover layouts, sample schedules or placeholder policy merely because an artboard shows them.
- **Don't** add resting-card shadows, a light theme, or new asset conventions when documenting this existing system.
- **Don't** use class or item-quality colors as brand fills; retain the narrow domain exceptions in PRODUCT.md.
- **Don't** treat recorded token values as proof of accessibility compliance or code-only observations as authenticated live verification.
