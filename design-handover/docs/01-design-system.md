# 01 — Design system

Visual reference: `reference/Main.html`.

The system is one dark ground, one ice text color, and two accents that never swap jobs.
**Sand is for accolade** — achievements, officer rank, the primary call to action.
**Teal is for interaction** — links, focus, selection, informational panels. If you find
yourself reaching for a third accent, the answer is a neutral.

---

## Color

All values live in `design/tokens.css`. The ones worth understanding:

**Ground** climbs in five steps from `--ink-950` (page) to `--ink-700` (input fill). A card
is `--ink-850` with a `--line` hairline; on hover it goes to `--ink-800`. There is no step
between card and page other than that border — on ink, a 1px hairline separates better than
a shadow, and shadow is reserved for things floating over a scrim.

**Text** has exactly three levels. `--fg-3` at 4.7:1 is the floor; nothing dimmer ships.
Caption grey and colored fills under white text are what fail contrast in practice — if you
add a new tint, check it.

**Status** is `ok` / `warn` / `stop`, each with a `wash` fill and a `line` border for pills.
Never use color alone: every pill carries its word ("High need", "Medium", "Closed"), so the
table still reads in greyscale and for colorblind raiders.

### Class colors

`design/class-colors.ts`. Text only — character names, class labels, role counts. Never a
background fill, never a border. Shaman and Warlock ship lifted (`onInk`); the other seven
are unchanged from in-game.

---

## Type

Three families, loaded from Google Fonts with `display=swap`:

```
Cinzel      600         eyebrows only — one or two words, uppercase, 0.3em tracking, sand
Newsreader  400 / 500   display — anything that makes a claim
Archivo     400–700     UI — everything you operate
```

Cinzel is inscriptional and echoes the column mark; it appears above a heading and nowhere
else. Newsreader carries headlines and large stat figures. Archivo does the rest.

Scale is in `design/tailwind.config.ts`. The shape of it:

| Token | Size / line | Use |
|---|---|---|
| `eyebrow` | 12 / 0.3em tracking | Cinzel, sand, above an h1 or h2 |
| `display-xl` | 64 / 1.04 | Page hero only |
| `display-l` | 44 / 1.1 | Section opener |
| `display-m` | 30 / 1.2 | Card heading, sub-section |
| `title` | 20 / 1.3 | Archivo 600 — row titles, panel headings |
| `body` | 16 / 1.65 | Paragraphs, `--fg-2` |
| `small` | 13 / 1.55 | Meta, help text |
| `label` | 11 / 0.14em | Uppercase, `--fg-3` — table headers, field labels |

**Every number gets `font-variant-numeric: tabular-nums`** — times, counts, percentages,
kill counts. The `.tabular` class in tokens.css exists for this.

Paragraphs cap at `max-w-prose` (680px). Hero copy caps at 620px.

---

## Space, radius, depth

4px base. Page gutter 96 desktop / 16 mobile. Section gap 72. Card padding 24–32.
Control gap 12. Nothing lands off the 4px step.

Radii are deliberately tight, because the mark is square-cut: tag 2, button and input 4,
card 8, modal 14, avatar full.

Depth has three levels and only the third uses a shadow — see `--shadow-pop` (popover,
dropdown) and `--shadow-modal`.

Layout is flex or grid with `gap`, never margins between siblings.

---

## Time

The site is for people in several timezones playing on one realm, so **no time is ever
rendered alone.** Every time appears as realm time plus the viewer's local time, each
labelled, with the realm value styled `--sand` and the local value `--teal`.

- Detect with `Intl.DateTimeFormat().resolvedOptions().timeZone`, show the IANA name, and
  let the member override it — store the override on the user row.
- Realm timezone is a single config constant, not a per-page value.
- The artboards use `America/Los_Angeles` (PDT) viewing a `CDT` realm, a two-hour offset.
  Make the offset real, not a constant — DST transitions differ by zone.
- Label wording, used consistently: **"server"** and **"your time"** / **"yours"**.

---

## Motion

Almost none. 120ms ease on hover and focus transitions, nothing else. No page transitions,
no scroll animation, no entrance effects. The one moving thing on the site is the loading
skeleton's 1.6s opacity pulse.

---

## Things this system deliberately doesn't do

Gradient backgrounds. Cards with a colored left border. Emoji as UI glyphs. Rounded
everything. Drop shadows on resting surfaces. A light theme. Inter.
