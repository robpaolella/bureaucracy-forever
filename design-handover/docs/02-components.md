# 02 — Components

Visual reference: `reference/Components.html` (primitives) and `reference/Nav-States.html`
(header, drawer, footer).

Every page in the design is assembled from these. If a page needs something that isn't here,
add it here first.

---

## Button

```ts
<Button variant="primary" | "secondary" | "ghost" | "danger"
        size="lg" | "md" | "sm"
        loading?  disabled?  icon? />
```

| Variant | Fill | Text | Border |
|---|---|---|---|
| `primary` | `sand` | `ink-950` | none |
| `secondary` | transparent | `fg` | `line-strong` |
| `ghost` | transparent | `fg-2` | none |
| `danger` | transparent | `stop` | `stop-line` |

Sizes are `lg` 52px / `md` 44px / `sm` 44px — **`sm` is narrower, not shorter.** 44px is the
floor everywhere. Radius `control`. Hover is `filter: brightness(1.1)`.

`loading` drops opacity to 0.75, disables the button and prepends a 13px spinner in the
button's own text color. `disabled` is `ink-700` fill, `fg-3` text, `cursor: not-allowed`.
Icon-only buttons are 44×44 and require `aria-label`.

One primary action per page, repeated down the page — never three competing buttons in a row.

**Link style** is a separate thing, not a button variant: `teal` text, 1px `teal-dim`
bottom border, 2px padding beneath.

---

## Field / Select / Choice / Toggle

```ts
<Field label hint error>  // wraps input | textarea
<Select label options />
<Choice type="radio" | "checkbox" />
<Toggle label checked />
```

Label is `label` token, uppercase, `fg-2`, above the control. Input is 46px, `ink-700` fill,
`line-strong` border, radius `control`, 15px text. Hint is `small` / `fg-3` below. Error
swaps the border to `stop-line` and the hint to `stop` — the hint slot is the error slot,
they never both show.

Radio and checkbox use `accent-color: var(--teal)` at 16px. A selected radio **card** (the
Raider/Social picker, the availability answers) gets `teal-wash` fill and `teal` border.

A read-only field pre-filled from Discord (the handle on the application form) is `ink-800`
fill, `line` border, `fg-3` text.

---

## Tag / StatusPill / RankBadge / SourceBadge / CountBadge

```ts
<Tag>Melee DPS</Tag>                           // ink-700, line-strong, radius tag
<StatusPill tone="ok" | "warn" | "closed">     // wash + line + dot + word, radius full
<RankBadge rank="officer" | "raider" | "trial" | "social" />
<SourceBadge source="web" | "discord" />
<CountBadge>7</CountBadge>                     // sand fill, ink text, radius full
```

`RankBadge` is uppercase 11px / 0.1em. Officer is the only one that takes sand
(`sand-wash` fill, `sand-dim` border, `sand` text); raider is neutral with a `line-strong`
border; trial and social are neutral and dimmer.

`SourceBadge` marks where a raid sign-up came from — `web` is neutral, `discord` is teal.
It's always present on a sign-up row, never inferred or hidden.

---

## Card / StatCard

`Card` is `ink-850`, `line` border, radius `card`, padding 24–32. `StatCard` adds a Cinzel
eyebrow in sand, a Newsreader figure at 40px, and a `small` caption.

An accolade card — the three Classic achievements on About, the loot summary, the
find-windows panel — swaps the border to `sand-dim`. That's the whole treatment; no fill
change, no icon.

---

## DataTable

```ts
<DataTable columns rows sortKey sortDir onSort density="comfortable" | "compact" />
```

Header row is `ink-850`, `label` token, `fg-3`, sortable columns show a teal arrow on the
active key. Rows are 44px, separated by `line-faint`, zebra-striped with `ink-850` on odd
rows, hover `ink-850`. Numeric columns right-align and go tabular.

Built to hold 40+ rows without a scroll trap: the page scrolls, the table doesn't. On mobile
the table becomes a stacked card list — see `docs/04 § Roster`.

---

## Modal

`ink-800` surface, `line-strong` border, radius `modal`, `shadow-modal`, over a
`rgba(6,8,11,0.72)` scrim. Newsreader title at 22px, `body`/`fg-2` paragraph, actions
bottom-right with ghost cancel first and the real action last. Focus trap, Escape closes,
return focus to the trigger.

---

## EmptyState

Centred column inside a **dashed** `line-strong` border: the column mark at 40px and 28%
opacity, a 16px `fg` heading, a `small`/`fg-2` sentence capped at 260px, and one secondary
button. Every empty state names what will fill it and who fills it — see `docs/04 § Empty`.

---

## Skeleton

Bars at `ink-700`, radius 2, widths varied (45% / 80% / 62%), pulsing opacity 0.35→0.7 over
1.6s. Use skeletons for the roster, calendar and heatmap; use nothing for content that
arrives server-rendered.

---

## SiteHeader

```ts
<SiteHeader session={null | member | officer} />
```

72px tall, `ink-950`, bottom border `line-faint`. Wordmark at 22px, then the four public
links, which **never move between states**. The active link gets `fg` text and a 2px sand
bottom border.

| Session | Adds to nav | Right side |
|---|---|---|
| `null` | — | "Log in with Discord" (secondary) + "Join Discord" (primary) |
| `member` | **Members ▾** group | "Join Discord" (secondary) + avatar pill |
| `officer` | **Members ▾** and **Officers ▾** (sand, with pending count) | same, avatar pill carries the Officer badge |

Group menus are 260–288px popovers on `ink-800` / `line-strong` / `shadow-pop`, 4px radius
rows. Members holds My availability (with a "Not submitted" warn note when true), Roster,
Raid calendar. Officers holds Applications (count), Availability heatmap, Schedule a raid,
Edit class needs.

The avatar pill is a 28px circle with initials in the member's class color, their name in
class color beside it, inside a `line` pill with full radius.

**Mobile:** wordmark at 18px, a compact "Discord" primary button, and a 44px menu button
opening a full drawer — public links, then a Members section, then an Officers section,
each under a `label`-token divider heading. 16px rows, 14px vertical padding.

---

## Footer

Wordmark at 16px / 70% opacity, the four public links, and one line:

> Bureaucracy · WoW Forever · Not affiliated with Blizzard Entertainment.

That disclaimer ships on every page.
