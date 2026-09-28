---
version: alpha
name: habit-tracker-design
description: >
  Design contract for the Gestor de hábitos web app (React + Vite + TypeScript).
  Calm, focused, single-column productivity feel: soft indigo→violet brand
  gradients, generous rounded surfaces, light-and-dark via prefers-color-scheme.
  Source of truth is frontend/src/styles.css :root tokens; this file mirrors them
  for agents. Component families: buttons, pill nav, cards/forms, today checklist
  with per-habit accent dot, habit list, calendar grid + stat cards, progress bars.
  Constraint: colors must reference tokens (or the per-habit --dot custom property),
  never hard-coded literals in feature code.
colors:
  bg: "#eef2f7"
  surface: "#ffffff"
  surface-2: "#f8fafc"
  text: "#0f172a"
  muted: "#5f6d80"
  border: "#e6eaf0"
  border-strong: "#d5dbe5"
  primary: "#4f46e5"
  primary-strong: "#4338ca"
  on-primary: "#ffffff"
  accent: "#7c3aed"
  accent-2: "#8b5cf6"
  danger: "#e11d48"
  success: "#16a34a"
typography:
  heading-lg:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: 1.4rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  heading-md:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: 1.05rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  body-md:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  body-sm:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: 0.9rem
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0px
  caption:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: 0.78rem
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0px
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: 0.8rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.04em
  button-md:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: 0.9rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0px
rounded:
  none: 0px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 22px
  full: 999px
spacing:
  xxs: 0.25rem
  xs: 0.35rem
  sm: 0.6rem
  md: 0.9rem
  lg: 1.25rem
  xl: 1.5rem
  section: 3rem
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 0.6rem 1.05rem
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 0.6rem 1.05rem
  button-primary-disabled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 0.6rem 1.05rem
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 0.6rem 1.05rem
  button-ghost-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 0.6rem 1.05rem
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 0.6rem 1.05rem
  nav-link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 0.45rem 0.85rem
  nav-link-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 0.45rem 0.85rem
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 1.25rem
  text-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 0.65rem 0.8rem
  text-input-focused:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 0.65rem 0.8rem
  day-toggle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    height: 2.5rem
    width: 2.5rem
  day-toggle-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: 2.5rem
    width: 2.5rem
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-strong}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 0.25rem 0.7rem
  stat-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 0.9rem 1rem
  calendar-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: 0.4rem
  calendar-cell-done:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: 0.4rem
  today-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 0.85rem 1rem
  auth-hero:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.heading-lg}"
  auth-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: 2.5rem 2rem
  empty-state:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 2.5rem 1.5rem
  icon-option:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    height: 2.6rem
  icon-option-selected:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: 2.6rem
---

# Gestor de hábitos — Design Contract

## Overview

The product should feel **calm, focused, and quietly rewarding**. It is a personal
habit tracker, so the UI stays out of the way: a single centered column
(`max-width: 880px`), soft surfaces on a tinted canvas, and one brand gesture —
an indigo→violet gradient — reserved for *active/positive* moments (primary
action, active nav, a completed day, a filled progress bar).

Two themes ship from the same tokens via `@media (prefers-color-scheme: dark)`.
Every color, radius, shadow, font, and motion value lives in `frontend/src/styles.css`
under `:root` (light) and the dark override block. **This file is the contract; the
CSS `:root` is the implementation.** If they disagree, fix the drift — do not let
feature code invent local values.

Dark mode keeps the same hue identity but deepens the primary a step
(`--primary` `#4f46e5` → `#5b5ce0`, chosen so white button text clears WCAG AA)
and lifts the accents (`--accent` `#7c3aed` → `#8b5cf6`, `--accent-2` `#8b5cf6` →
`#a78bfa`) so gradients stay legible on the darker canvas.

## Colors

Semantic roles (light values; dark values in parentheses where they differ):

- **Canvas & surfaces** — `bg` `#eef2f7` (`#0a0f1c`) page canvas with a fixed radial
  accent wash; `surface` `#ffffff` (`#121a2b`) cards/rows; `surface-2` `#f8fafc`
  (`#0f1626`) recessed fills (inputs, fieldsets).
- **Ink** — `text` `#0f172a` (`#e8edf6`) primary copy; `muted` `#5f6d80` (`#97a3b8`)
  secondary/labels (light value tuned to clear WCAG AA on the `bg` canvas);
  `on-primary` `#ffffff` text on brand fills.
- **Hairlines** — `border` `#e6eaf0` (`#223049`) default; `border-strong` `#d5dbe5`
  (`#2c3d5a`) inputs and hover edges.
- **Brand** — `primary` `#4f46e5` (`#5b5ce0`) main action/focus; `primary-strong`
  `#4338ca` (`#7c7ff5`) hover/link emphasis; `accent` `#7c3aed` and `accent-2`
  `#8b5cf6` are the gradient partners (never used as flat fills on their own).
- **Status** — `danger` `#e11d48` destructive + error text; `success` `#16a34a`
  reserved (defined, currently unused in UI — see Known Gaps).
- **Per-habit accent** — user-chosen habit colors are passed at runtime through the
  `--dot` CSS custom property (today checklist dot) and inline `background`
  (habit swatch). The shared fallback is `DEFAULT_COLOR = "#4f46e5"` in
  `frontend/src/lib/colors.ts`; do not re-type the literal elsewhere.

Gradients are tokens, not literals: `--grad` (primary→accent, 135°), `--grad-logo`
(primary→accent-2, 135°), `--grad-bar` (primary→accent-2, 90°). Use these; never
hand-write a `linear-gradient(...)` with raw hex in a component rule.

## Typography

Single family: Inter with a system-ui fallback stack (`--font`). Scale:

- `heading-lg` 1.4rem/700 — page titles (`h2` in main).
- `heading-md` 1.05rem/700 — card/form titles, calendar month label.
- `body-md` 1rem/400 lh1.5 — default reading text.
- `body-sm` 0.9rem/500 — nav links, inputs, selects, stat copy.
- `caption` 0.78rem/400 — calendar day numbers, badges, `.small`.
- `label` 0.8rem/600 uppercase, 0.04em — form field labels and legends.
- `button-md` 0.9rem/600 — all buttons.

Headings use tight tracking (`-0.01em`); labels/legends use positive tracking
(`0.04em`) with uppercase. Do not introduce new font sizes outside this scale —
add a level here first.

## Layout

- One column, `max-width: 880px`, centered, page padding `0 1rem 3rem`.
- Sticky header (`backdrop-filter: saturate(140%) blur(10px)`) holds logo + title
  and the pill nav; nav-user (email + Salir) is pushed right with `margin-left: auto`.
- Vertical rhythm: sections separated by `1.5rem`; rows/lists gap `0.6rem`;
  forms gap `0.9rem`; grids (stats, calendar) gap `0.75rem`/`0.4rem`.
- Density is comfortable, not compact — this is a daily-glance tool.
- `main` reserves `min-height: 55vh` so route swaps don't jump the footer.

## Elevation & Depth

Three shadows, all tinted with the ink color (light) or neutral black (dark):

- `--shadow-sm` — resting cards, rows, buttons, logo, active nav.
- `--shadow-md` — hover lift on rows/buttons (`translateY(-1px)`).
- `--shadow-lg` — defined for overlays; currently unused (Known Gaps).
- `--ring` `0 0 0 4px rgba(79,70,229,0.18)` — the single focus-visible treatment.

Depth is expressed as *lift on hover* (translate + shadow bump), not stacking new
z-layers. Header is the only elevated surface (`z-index: 20`).

## Shapes

Radius scale: `sm 8px`, `md 12px`, `lg 16px`, `xl 22px`, `full 999px`.

- Cards, list rows, stat cards, inputs, buttons → `lg`/`md`.
- Pills (nav links, badges, progress tracks/bars) → `full`.
- Circular: today checkbox dot and calendar dot use `border-radius: 50%`.
- Focus ring rounds to `sm` via the global `:focus-visible` rule.

Do not mix radii within a component family — the today-item, habit-item, and card
all share `lg` deliberately.

## Components

States below use the same token names as the frontmatter.

- **Buttons** — `button-primary` carries `--grad` + `--shadow-sm`; hover adds
  `--shadow-md` and `translateY(-1px)`; active resets; disabled is `opacity .55`,
  `cursor: not-allowed`, no lift. `button-ghost` is surface + border-strong,
  hovering to surface-2 with primary border/text. `button-danger` is transparent
  with a danger-tinted border, filling `danger-soft` on hover. `btn-link` is a
  text-only action with a dashed underline. All share `button-md` typography.
- **Nav** — `nav-link` (muted, pill) → hover primary-soft; `nav-link-active` uses
  `--grad` + on-primary text. Router `NavLink` supplies the `.active` class.
- **Cards / forms** — `card` is the base surface. Labels are uppercase micro-type;
  inputs use `text-input` (surface-2 fill) → `text-input-focused` (surface fill,
  primary border, `--ring`). Fieldsets group the frequency radios + day toggles.
- **Day toggles** — `day-toggle` (surface, muted) → `day-toggle-on` (`--grad`,
  on-primary). Used for weekday selection; each is a real `<button>` with the `.on`
  class reflecting state.
- **Today checklist** — `today-item` row: a `.check` button wrapping a `.dot`.
  The dot border is always `--dot` (habit color); when complete it gains `.done`
  which fills `background: var(--dot)` and shows a ✓, and the label gains
  `.today-name.done` (line-through + `opacity .6`). A trailing `badge` shows the
  current streak. Above the list, `.today-summary` reports "N de M completados hoy"
  with a `.progress` bar (`--grad-bar` fill, width = completion %).
- **Habit list** — `habit-item` row with a colored `.swatch` (inline background =
  habit color, white glyph), name, schedule summary, and Editar/Eliminar buttons.
- **Calendar** — `.cal-nav` (prev/next ghost buttons + month label), a filter
  `select`, a `.stats-row` of `stat-card`s (streak/best/30d + a `.bar` progress
  using `--grad-bar`), and a 7-column `.cal-grid`. `calendar-cell` is the base;
  `calendar-cell-done` uses `--grad` + on-primary; `.today` adds an inset primary
  ring; `.empty` cells are borderless spacers.
- **Auth (split panel)** — `.auth-split` is a two-column card (`rounded.xl`,
  `--shadow-lg`) inside a `900px` shell. Left `.auth-hero` holds a full-bleed
  generated image (`src/assets/auth-hero.png`, indigo→violet abstract) under a
  bottom-anchored `.auth-hero-copy` (logo chip + headline + tagline) legible via a
  dark bottom gradient scrim; it is `aria-hidden` (decorative). Right `.auth-panel`
  (`.auth`) centers the form. Below `720px` it stacks to one column and the hero
  collapses to a `180px` banner. The only raster asset in the app.
- **Empty state** — `.empty-state` (dashed `border-strong` outline, translucent
  surface) centers an inline `svg.empty-art` line illustration drawn with tokens
  (`es-badge` fill = `primary-soft`, `es-check` stroke = `primary`), a title, an
  optional muted hint, and an optional action. Rendered by the shared
  `components/EmptyState.tsx`; used on Today (with a "create habit" CTA) and
  Habits (hint only, since the form is above). Prefer this over bare `.muted` text.
- **Icon picker** — `components/IconPicker.tsx` renders the curated emoji set from
  `lib/icons.ts` (`HABIT_ICONS`, 40 glyphs) as a responsive grid of `icon-option`
  toggle buttons plus a leading "∅" (no-icon) option. Each is a real `<button>`
  with `aria-pressed`; the selected one gains `.on` (`icon-option-selected`:
  `primary-soft` fill, `primary` border, `--ring`). Clicking the active icon again
  clears it. Replaces the old free-text icon input in the habit form; the chosen
  glyph persists as the habit's `icon` and renders in the swatch and Today label.

## Do's and Don'ts

**Do**

- Reference tokens (`var(--primary)`, `var(--grad)`, `var(--r-lg)`) in every rule.
- Route per-habit colors through `--dot` / the `DEFAULT_COLOR` constant.
- Model state with classes (`.done`, `.on`, `.active`, `.today`), not inline styles.
- Keep the brand gradient reserved for positive/active semantics.
- Provide `:focus-visible` via the shared `--ring`; never remove outlines without it.
- Verify both light and dark when touching colors.

**Don't**

- Don't hard-code hex/rgb in feature CSS or JSX (the whole point of the debt cleanup).
- Don't hand-write `linear-gradient(...)` with raw colors — use `--grad*`.
- Don't add font sizes, radii, or shadows outside the documented scales.
- Don't encode meaning with color alone (see Accessibility).
- Don't use inline `style` for anything a class can express (dynamic width/% and
  the per-habit `--dot`/swatch color are the only sanctioned exceptions).

## Accessibility

- **Contrast** — `text` on `surface`/`bg` and `on-primary` on `primary`/gradients
  meet WCAG AA for normal text. Verified ratios: text/surface 17.9, text/bg 15.9,
  muted/surface 5.3, muted/bg 4.7, on-primary/primary 6.3 (light); dark
  on-primary/primary 5.2. `muted` is still for secondary copy, not long body text.
- **Focus-visible** — global `:where(button,a,input,select,textarea):focus-visible`
  applies `--ring`; it must remain visible in both themes.
- **Color-not-alone** — completion is signaled by shape + glyph, not hue: the dot
  fills *and* shows ✓, the label strikes through, the calendar cell shows a dot
  marker in addition to the gradient fill.
- **Semantics** — the today toggle is a `<button aria-pressed>`; day toggles and
  nav are real buttons/links; destructive delete asks for `window.confirm`.
- **Reduced motion** — animations are limited to short `--t` (160ms) transitions
  and 1px lifts, and a `@media (prefers-reduced-motion: reduce)` block collapses
  transition/animation durations and disables the hover lifts.
- **Forms** — every input has a visible `<label>`; errors render as `.error` text
  adjacent to the field, not only as a color change.

## Responsive Behavior

Single breakpoint at `max-width: 560px`: page padding tightens, nav-user wraps to a
full-width row, `h2` steps down to 1.2rem, calendar gap/padding shrink and cells
drop to `sm` radius, and today/habit rows are allowed to wrap. The layout is
single-column by default, so it degrades gracefully to narrow viewports without a
separate mobile design.

## Known Gaps

- `needs-design-decision` — `--success` `#16a34a` is defined but unused; decide
  whether completed-state or streak milestones should adopt it, or remove it.
- `needs-design-decision` — `--shadow-lg` and `--r-xl` are defined but unused;
  either reserve them for a future dialog/toast or drop them to reduce surface area.
- No toast/dialog/drawer patterns exist yet; if added, extend this contract first.
- Component tokens in frontmatter omit border/shadow/gap (per schema, those live in
  prose above); tooling that needs them must read the `## Components` section.
