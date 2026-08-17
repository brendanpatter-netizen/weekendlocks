---
name: WeekendLocks
description: A friend-group NFL/CFB pick'em app with a savage AI-generated weekly roast
colors:
  board-felt: "#063D31"
  chalk-white: "#F5F3E7"
  chalk-white-soft: "rgba(245,243,231,0.7)"
  chalk-white-faint: "rgba(245,243,231,0.2)"
  marker-red: "#B23A2E"
  tape-gold: "rgba(244,196,48,0.55)"
  tape-gold-border: "rgba(180,140,20,0.35)"
  dashed-gold: "#B4901F"
  paper-shadow-line: "rgba(12,23,18,0.18)"
  ink: "#0C1712"
  ink-soft: "#45564C"
  ink-body: "#2A362F"
  paper-disabled: "#D8D4C4"
  turf-teal: "#0B735F"
  slate-ink: "#0F172A"
  slate-soft: "#64748B"
  slate-faint: "#94A3B8"
  slate-body: "#334155"
  hairline: "#E5E7EB"
  win: "#DCFCE7"
  loss: "#FEE2E2"
  pending: "#F1F5F9"
  danger: "#DC2626"
  danger-bg: "#FEF2F2"
  danger-border: "#FECACA"
  danger-title: "#991B1B"
  danger-body: "#B91C1C"
  warning-bg: "#FFF7ED"
  warning-border: "#FED7AA"
  warning-text: "#9A3412"
  info-bg: "#EFF6FF"
  info-border: "#BFDBFE"
  info-text: "#1D4ED8"
  highlighter-fill: "#FAC775"
  highlighter-ink: "#412402"
  identity-1-bg: "#E1F5EE"
  identity-1-fg: "#085041"
  identity-2-bg: "#FAECE7"
  identity-2-fg: "#712B13"
  identity-3-bg: "#EEEDFE"
  identity-3-fg: "#3C3489"
  identity-4-bg: "#E6F1FB"
  identity-4-fg: "#0C447C"
  identity-5-bg: "#FBEAF0"
  identity-5-fg: "#72243E"
  identity-6-bg: "#FAEEDA"
  identity-6-fg: "#633806"
typography:
  display:
    fontFamily: "PermanentMarker_400Regular"
    fontSize: "40px"
    letterSpacing: "0.5px"
  page-title:
    fontFamily: "PermanentMarker_400Regular"
    fontSize: "26px"
  title:
    fontFamily: "PermanentMarker_400Regular"
    fontSize: "20px"
  label:
    fontFamily: "System"
    fontSize: "11-13px"
    fontWeight: 800
    letterSpacing: "0.3px"
  body:
    fontFamily: "System"
    fontSize: "13px"
    fontWeight: 700
rounded:
  pill: "999px"
  card: "10px"
  cta: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.turf-teal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.chalk-white}"
    rounded: "{rounded.card}"
    padding: "12px"
---

# Design System: WeekendLocks

## Overview

**Creative North Star: "The Whiteboard"**

WeekendLocks is a locker-room whiteboard, not a dashboard. This is a full replacement of the product's prior visual world (a plain Turf Teal + slate + white-card system, preserved only as evidence, not as a system to extend). The board itself — a dark chalkboard-green ground (`#063D31`) — fills the screen and is the header; there is no separate hero card. The group's name is hand-lettered directly onto the board in large chalk-white marker type, next to a drawn padlock icon. Every section below it reads as a sheet of paper taped up on that board: chalk-paper fill, a dashed hand-drawn outline instead of a hairline, and a masking-tape accent pinned to one corner. Cards themselves stay square — an earlier pass tilted them a degree or two, but that read as broken alignment rather than charm; the hand-made feel now lives entirely in small accents (the tape corner, a scattered team badge) instead of the card body itself, and even those stop short of any element that reads as a piece of UI chrome rather than a physical prop.

The tone stays loud and personal — this is still the app where the group's AI-generated Power Rankings roast bot lives — but the loudness now comes from material (chalk, marker, tape, paper) instead of from a generic dark-mode sports-app template. Bold system-sans data (member names, records, pick text) sits inside the paper sheets; hand-lettered marker type is reserved for section titles and the group name, so the two voices stay distinct: the board talks in marker, the data talks in a normal confident sans.

**Coverage:** Fully rolled out — group dashboard, NFL/CFB picks pages, groups list/join flow, account, all three auth screens, and the home/marketing page all run on this world now. The home hero's headline is the one place PermanentMarker sizes up past the 20px section-title tier (34px, on-board chalk-white) — the product's single loudest "written on the board" moment, reserved for that one spot.

**Key Characteristics:**
- One board, not per-group hero colors: every group lands on the same felt-green board; identity now lives in the hand-lettered name and member avatar chips, not a per-group hash background.
- Paper-pinned-to-board is the universal card language: dashed border and a `TapeCorner` accent — applied consistently by reusing one component, never hand-rolled per file. Cards themselves are square; see The Accent-Only Tilt Rule.
- PermanentMarker is reserved for exactly two roles: the group name (40px) and section titles (20px, marker-red). It never appears on data, buttons, or body text.
- No emoji anywhere in the product, ever — every glyph that used to be an emoji (🔒, 🏆, 🔥) is now an authored SVG icon (`LockIcon`, `TrophyIcon`, `FlameIcon`) drawn as a thick rounded marker-style stroke, matching hand and weight. Emoji reads as generic AI-tool output; a drawn icon reads as this product's own.
- The #1 spot in Power Rankings is circled in marker (transparent fill, 2px marker-red ring) instead of a filled badge — "the coach circled your name on the board," the product's actual differentiator getting the loudest treatment on the page. Straight, not tilted — see The Accent-Only Tilt Rule.
- No avatar chip anywhere a member's name is already shown in the same row: Standings, Power Rankings, Recent Activity, and Chat all dropped their initials circle — it repeated identity the name already carried. The color-identity system survives only where the name isn't separately visible: the Weekly Locks grid's member-column header, whose colored background *is* the name cell.
- Standings and Power Rankings carry real shadow lift (`shadowOpacity: 0.3`); Recent Activity and Chat stay flatter — not every sheet on the board is pinned with the same weight.

## Colors

The palette is deliberately narrow: one dark board ground, one paper fill, one marker-red ink, one gold accent for tape and dashed trim. Semantic colors (win/loss/pending, danger, warning) and the six-color member-identity system carry over unchanged from the prior world.

### Primary
- **Board Felt** (#063D31): The page background on every group screen — the chalkboard itself. Also the header nav bar fill (`app/_layout.tsx`).
- **Marker Red** (#B23A2E): Section titles ("The Standings", "Weekend Locks", "Power Rankings"), every drawn section icon (`LockIcon`, `TrophyIcon`, `FlameIcon`), and the #1 rank circle in Power Rankings. The one accent ink color that reads as "hand-marked."

### Secondary
- **Chalk White** (#F5F3E7): Two roles — (1) the paper-sheet fill for every card, and (2) the hand-lettered ink color for text written directly on the board (hero eyebrow, group name, subtitle). Same hex, two functions, deliberately: it's the one color that reads as "chalk" whether it's the marker stroke or the sheet itself. Softened to 70% opacity for the hero subtitle and 20-40% for dashed trim on the board.
- **Dashed Gold** (#B4901F): The invite-link row's dashed border — a warmer, more saturated gold than tape, used once as a callout trim.
- **Tape Gold** (rgba(244,196,48,0.55), border rgba(180,140,20,0.35)): The `TapeCorner` accent pinning every card to the board. Always this exact translucent value — it should read as semi-transparent masking tape, not an opaque gold chip.

### Neutral
- **Ink** (#0C1712): Primary text on chalk-paper surfaces (pick CTA titles, invite code).
- **Ink Soft** (#45564C): Secondary text on paper (subtitles, invite label).
- **Ink Body** (#2A362F): Long-form paragraph text on paper — the Power Rankings roast copy specifically, a shade lighter than Ink so a full paragraph doesn't read as heavy as a name or label.
- **Paper Disabled** (#D8D4C4): Flat muted fill for a disabled paper-surface control (an unopened week's pick CTA) — never opacity, which would muddy chalk-paper into the board color behind it.
- **Turf Teal** (#0B735F): Survives from the prior world as the one non-board/paper accent — still used for the Share/Refresh pill buttons' border and fill, and copy-link button. Deliberately not replaced with marker-red, so primary actions stay visually distinct from section chrome.
- **Slate Ink** (#0F172A) / **Slate Soft** (#64748B) / **Slate Faint** (#94A3B8) / **Slate Body** (#334155): Carried over from the prior neutral scale for dense data (leaderboard numbers, activity feed timestamps, table headers) inside paper cards — these surfaces stay closer to a normal data-table voice than the board's hand-marked one.
- **Hairline** (#E5E7EB): Row dividers inside paper cards (leaderboard rows, activity feed rows).

### Semantic
- **Win** (#DCFCE7) / **Loss** (#FEE2E2) / **Pending** (#F1F5F9): Unchanged from the prior world — the three pick-cell states in the Weekly Locks grid.
- **Danger** (#DC2626) with its pale-red callout (bg #FEF2F2, border #FECACA, title #991B1B, body #B91C1C): The Delete Group control — deliberately left out of the paper-and-board language entirely; it stays a plain red alert box so a destructive action never looks like part of the playful board.
- **Warning banner** (bg #FFF7ED, border #FED7AA, text #9A3412): The "Heads up: ..." error banner — unchanged.
- **Info banner** (bg #EFF6FF, border #BFDBFE, text #1D4ED8): The CFB picks page's gap-week notice ("pick two CFB locks this week instead of one CFB + one NFL"). Like Danger and Warning, this stays a plain alert box outside the paper/board language — it's a system message, not a board fixture.
- **Highlighter** (fill #FAC775, ink #412402): The home page's "Free to play with your crew" pill — a solid highlighter-yellow flag, slightly rotated like a sticky note pressed onto the board. The one accent color that's neither chalk, marker, nor tape gold, reserved for this single promotional flag.

### Identity Palette (Named Rule)
**The Same Hash, Different Canvas Rule (narrowed).** The six pastel/deep identity color pairs (`lib/avatar.ts`) still power member identity color wherever it's shown — currently only the Weekly Locks grid's member-column header background. Standings, Power Rankings, Recent Activity, and Chat intentionally show no avatar chip at all (see Key Characteristics); this rule governs the color whenever member identity color does appear, not whether an avatar chip exists. Under The Whiteboard this rule no longer extends to group hero backgrounds — every group now shares one board color, and per-group identity moved to the hand-lettered name instead. Never assign these six colors manually or add a seventh; the hash math and every member's existing color assignment depend on the array staying fixed.

## Typography

**Display/Title Font:** PermanentMarker_400Regular (loaded as a local asset, `assets/fonts/PermanentMarker-Regular.ttf`), with no fallback substitute in the same role — if it fails to load, headings fall back silently to the system font rather than a second marker-style face.
**Body/UI Font:** System default — unchanged from the prior world.

**Character:** Two voices, kept strictly apart. PermanentMarker is the board's own hand: it appears only on the group name and section titles, uppercase-adjacent and slightly irregular by nature of the face itself. Everything else — data, buttons, labels, chat — stays in the system sans at 700/800 weight, so the product never tips into "everything is hand-lettered" novelty; the marker voice stays rare and therefore legible as a signature.

### Hierarchy
- **Display** (PermanentMarker, 40px, uppercase, centered, line-height 46): The group name, lettered directly on the board. The only 40px text in the product.
- **Page Title** (PermanentMarker, 26px, chalk-white): A page's own on-board headline when it isn't a group name — currently the NFL/CFB picks pages ("This Weekend's NFL Locks"). Chalk-white, not marker-red, because it sits directly on the board like the hero rather than on a paper card; sized between Display and Title since it's a real headline but a secondary one.
- **Title** (PermanentMarker, 20px, marker-red): Section headers on every paper card ("The Standings", "Power Rankings", "Weekend Locks", "Recent activity").
- **Label** (800, 11–13px, often uppercase with letter-spacing): Eyebrow ("THE BOARD"), table headers, timestamps, legend text.
- **Body** (700, 13px): Member names, pick descriptions, chat messages, CTA subtext — the system-sans data voice.

### Named Rules
**The Two-Voice Rule.** PermanentMarker is reserved for exactly two roles — the group name and section titles. It never appears on a button, a data value, or body copy; introducing it elsewhere dilutes the one signal that something is "written on the board" versus "printed on paper."

## Layout

Single-column, card-stacked layout, unchanged in structure from the prior world (`gap: 16` between cards). The board (`pageOuter`) is the scroll container's background; the hero no longer renders as a bounded card, so it reads as the top of the board itself rather than the first tile in the stack. Horizontal scrolling remains deliberate inside the Weekly Locks grid.

## Elevation & Depth

Hybrid: the board and most paper cards are flat (dashed border does the separation work, not shadow), but Standings and Power Rankings — the two surfaces DESIGN.md calls out as worth the most craft — carry real shadow lift so they read as the pinned, worth-looking-at sheets on the board. The two hero pick CTAs (NFL/CFB) carry the strongest shadow of anything on the page, reinforcing them as the most tappable targets.

### Shadow Vocabulary
- **Card lift** (`shadowColor: #000, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {0,5}, elevation: 5`): Standings and Power Rankings.
- **CTA lift** (`shadowColor: #000, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: {0,5}, elevation: 6`): The hero NFL/CFB pick buttons — slightly stronger than card lift, since these are the primary tap targets on the page.
- **Auth lift** (`shadowColor: #000, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: {0,8}, elevation: 8`): The sign-in and reset-password cards — the softest but deepest-reaching shadow, since these single-card pages have nothing else competing for weight.

### Named Rules
**The Two-Tier Lift Rule.** Not every paper sheet gets the same shadow. Recent Activity and Chat stay flat (dashed border only); only the two data surfaces the product actually differentiates on (Standings, Power Rankings) and the two hero CTAs earn shadow — shadow signals "this is worth looking at," not "this is a card."

## Shapes

**The Dashed Border Rule.** Every paper card uses a dashed 1.5px border (`rgba(12,23,18,0.18)`, 10px radius) instead of the prior world's solid hairline, so the board reads as hand-assembled rather than grid-aligned. Interactive pills (Share, Refresh, invite copy) stay fully round (999px) — the one shape carried over unchanged from the prior world. The hero CTA buttons use a softer 16px radius, between "pill" and "card," to read as bigger, weightier tap targets.

**The Accent-Only Tilt Rule.** Cards themselves are always square — no card, at any size, on any page, carries a rotation transform. Any element that reads as a piece of UI (a badge, a circle, a chip a user taps or reads as a control) is also always square — an early pass tilted the Power Rankings #1 circle `-4deg` as a "circled in marker" gesture, but direct user feedback flagged it as looking crooked, not hand-marked, so it's straight now. Tilt survives only where it reads as a physical prop rather than UI: the `TapeCorner` component (`-3deg`/`3deg`, literal tape), and the home page's individually-rotated team-logo badges and step-icon chips (small, decorative, scattered like photos on a corkboard, never a control). If it's a badge, a card, or anything a user reads as interface, it's square.

**The List Restraint Rule.** The `TapeCorner` accent itself is for single-instance surfaces (a section card, an empty-state card, a status strip) — never for items inside a repeated list. The NFL/CFB picks pages' game cards and the groups list's roster rows keep the chalk-paper fill and dashed border for board continuity but carry no tape, exactly like the Weekly Locks grid's internal cells.

## Components

### Buttons
- **Shape:** Pill (999px) for standalone actions (Refresh scores, Share invite).
- **Primary:** Turf Teal fill or border, white or teal text — unchanged from the prior world; deliberately not re-skinned in marker-red, so actions stay visually distinct from board chrome.
- **Hero CTA:** Chalk-paper fill, dashed border, 16px radius, strong shadow. Disabled state swaps to flat `#D8D4C4` fill, never opacity.

### Cards / Containers
- **Corner style:** 10px radius, dashed 1.5px border, always square (see The Accent-Only Tilt Rule).
- **Background:** Chalk white (`#F5F3E7`).
- **Pin accent:** A `TapeCorner` (translucent gold rectangle, `-3deg`/`3deg`, `side="left"` default) on single-instance cards — always the shared component, never a one-off inline style, and never on repeated-list items (see The List Restraint Rule).
- **Internal padding:** 12px, `paddingTop: 16` to clear the tape accent, `gap: 4` between header and body.

### Section Icons
Every section that once carried an emoji now carries a matching authored SVG instead: `LockIcon` (padlock, Weekly Locks / board eyebrow), `TrophyIcon` (Standings), `FlameIcon` (Power Rankings). All three share one visual grammar — unfilled shapes, `strokeWidth` ~2.2–2.4, rounded caps/joins, sized 13–22px, colored to match their context (chalk-white on the board, marker-red on paper). A new section icon should extend this set rather than reach for an emoji or a filled icon-font glyph.

### Weekly Locks Grid (signature component)
Unchanged in function and data density from the prior world — still the season-long spreadsheet tracker. Restyled to the paper-card language (dashed border, tape corner, PermanentMarker title with the drawn `LockIcon` beside it in marker-red) but the internal grid cells (win/loss/pending colors, legend) intentionally kept in their original slate/semantic colors — the grid should stay legible as a spreadsheet even as the shell around it got louder.

### Power Rankings (signature component)
Countdown list, #1 first, no avatar chip (name carries identity; see The Same Hash, Different Canvas Rule). The rank-1 badge is the one place this pass changed a functional treatment, not just a shell: a filled dark pill became a transparent marker-red circle outline, straight — the board's own "circled in marker" gesture, applied to the product's actual differentiator.

### Navigation
Unchanged: minimal top bar (Groups / Account / Sign in-out) on the board-felt background.

## Do's and Don'ts

### Do:
- **Do** route every card through the shared `card`/`cardElevated` style plus a `<TapeCorner />` — never hand-roll a dashed border or tape rectangle inline.
- **Do** keep PermanentMarker confined to the group name and section titles (see The Two-Voice Rule).
- **Do** draw a new authored SVG icon (matching `LockIcon`/`TrophyIcon`/`FlameIcon`'s stroke grammar) for any new section that would otherwise reach for an emoji — never use an emoji character anywhere in this product.
- **Do** give a card real shadow only when it's a genuinely high-value surface (see The Two-Tier Lift Rule) — not every paper sheet needs to look pinned with equal weight.

### Don't:
- **Don't** reintroduce per-group hash-colored hero backgrounds — every group now shares one board; identity lives in the name and avatars only.
- **Don't** use opacity to indicate a disabled state on a chalk-paper surface — it blends into the board behind it (the same bug class fixed once already in the prior world, now re-confirmed under the new palette).
- **Don't** add a seventh member-identity color or reorder the existing six — the hash math and every member's current color depend on the fixed array.
- **Don't** apply the paper-card language to the Danger Zone — it stays a plain red alert box, deliberately outside the board's playful material system.
- **Don't** rotate a card, badge, or any element a user reads as UI. Confirmed twice by direct user feedback — first on card-scale tilt, then again on the Power Rankings #1 circle specifically. Tilt only ever belongs on physical-prop accents (see The Accent-Only Tilt Rule).
- **Don't** use an emoji character anywhere in this product, including in code comments' example strings — it's the single fastest tell of generic AI-tool output, and this product draws its own icons instead.
- **Don't** add a member avatar chip next to a name that's already shown in the same row — it's redundant identity, not a second signal. This now applies everywhere in the product (Standings, Power Rankings, Recent Activity, Chat all dropped theirs); only add member identity color where the name isn't separately visible, like the Weekly Locks grid header.
