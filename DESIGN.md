---
name: WeekendLocks
description: A friend-group NFL/CFB pick'em app with a savage AI-generated weekly roast
colors:
  turf-teal: "#0B735F"
  turf-teal-deep: "#085041"
  felt-green: "#063D31"
  felt-green-raised: "#0A4C3D"
  brass-gold: "#B3781F"
  brass-fill: "#F2C266"
  brass-ink: "#4A3106"
  ink: "#0F172A"
  ink-soft: "#64748B"
  ink-faint: "#94A3B8"
  hairline: "#E5E7EB"
  divider: "#CBD5E1"
  surface: "#FFFFFF"
  surface-sunken: "#F8FAFC"
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
  disabled-fill: "#EBEDF2"
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
    fontFamily: "RobotoCondensed_900Black"
    fontSize: "44px"
    fontWeight: 900
    letterSpacing: "0.5px"
  title:
    fontFamily: "System"
    fontSize: "18px"
    fontWeight: 800
  label:
    fontFamily: "System"
    fontSize: "12px"
    fontWeight: 800
    letterSpacing: "0.3px"
  body:
    fontFamily: "System"
    fontSize: "13px"
    fontWeight: 700
rounded:
  pill: "999px"
  card: "12px"
  button: "8px"
  hero: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.turf-teal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "12px"
---

# Design System: WeekendLocks

## Overview

**Creative North Star: "The Locker Room"**

WeekendLocks is a bulletin board, not a dashboard. Every screen leans on heavy type (700/800 weight is the floor, not the ceiling — nothing in the product renders at regular weight), pill-shaped chips and buttons, and a deterministic per-person/per-group color-identity system so the same name always wears the same color. The tone is loud and personal by design: this is the app where the group's AI-generated Power Rankings roast bot lives, and the visual language should read as confident and a little brash, never as a sober fintech dashboard.

Two color systems currently coexist. The product surfaces members use every week — group dashboard, picks, chat, weekly recap — run on a plain **Turf Teal + slate neutrals + white card** system. A richer, warmer palette already exists in `lib/theme.ts` (Felt Green + Brass Gold) but is currently confined to the auth/account shell. That felt-and-brass system is a real, on-brand asset that isn't reaching the pages people actually open every week — a natural candidate to pull forward into the main product during upcoming bolder/delight work, not a competing system to remove.

**Key Characteristics:**
- Bold by default: no regular-weight text anywhere in the product.
- Pill everything interactive (999px radius); cards and panels use a consistent 12px radius.
- A single deterministic hash-color system powers both member avatars and each group's own hero background — six identity pairs, same math, two uses.
- Emoji-forward section headers (🏆 🔥 🔒) reinforce the "Locks" brand and the group's competitive, trash-talk personality.
- Currently flat-by-default with borders instead of shadows, but the confirmed direction is to open elevation up — more shadow/depth on card surfaces (Standings, Power Rankings) is invited going forward, not just reserved for the two hero CTA buttons.

## Colors

The palette is dominated by one working accent (Turf Teal) against a Tailwind-Slate neutral scale, with a richer felt/brass system waiting in the wings.

### Primary
- **Turf Teal** (#0B735F): The one true primary — every button, link, active tab, and accent across the product imports or should import this from `lib/theme.ts` (`colors.brand`). Deeper variant **Turf Teal Deep** (#085041) is used for hover/active states and as one of the six identity foreground colors.

### Secondary (available, underused)
- **Felt Green** (#063D31) / **Felt Green Raised** (#0A4C3D): Dark grounds for hero bands and nav, currently only rendered on auth screens. A strong candidate for the group hero band or other high-drama surfaces in the main product.
- **Brass Gold** (#B3781F, text-safe) / **Brass Fill** (#F2C266, fill) / **Brass Ink** (#4A3106, text-on-brass): A gold accent pair defined in `lib/theme.ts` but not yet used anywhere in the group/picks/recap surfaces. This is the most natural lever for "fantasy football trophy" energy — think rank-1 badges, a champion crown, a gold-trimmed hero — without inventing a new color.

### Neutral
- **Ink** (#0F172A): Primary text and card titles — this is Tailwind's `slate-900`, used as-is rather than a custom-named ramp.
- **Ink Soft** (#64748B) / **Ink Faint** (#94A3B8): Secondary and tertiary text (labels, timestamps, muted stats) — `slate-500` / `slate-400`.
- **Hairline** (#E5E7EB) and **Divider** (#CBD5E1): Card borders and row dividers — `slate-200` / `slate-300`.
- **Surface** (#FFFFFF) and **Surface Sunken** (#F8FAFC): Card fill and subtle recessed backgrounds (sub-headers, chat bubbles).

### Semantic
- **Win** (#DCFCE7) / **Loss** (#FEE2E2) / **Pending** (#F1F5F9): The three states every pick cell across the Weekly Locks grid and activity feed can be in — deliberately pale so the bold text inside stays the loudest thing on the cell.
- **Danger** (#DC2626): The Delete Group button itself.
- **Danger zone card**: pale red background (#FEF2F2), red border (#FECACA), a dark red title (#991B1B) and body (#B91C1C) — the destructive-action callout box on the group page, one step down in intensity from the button itself.
- **Warning banner**: pale orange background (#FFF7ED), orange border (#FED7AA), dark orange text (#9A3412) — the "Heads up: ..." error/warning banner shown for non-destructive problems (failed score refresh, etc).
- **Disabled fill** (#EBEDF2): Flat neutral fill for a disabled solid-colored control (the hero pick buttons before a week opens). Deliberately not opacity — see Do's and Don'ts.

### Identity Palette (Named Rule)
**The Same Hash, Different Canvas Rule.** Six pastel-background/deep-foreground color pairs are assigned by hashing a user's or group's ID (`lib/avatar.ts`). The exact same math produces a member's avatar color chip AND a group's own hero background color (via `avatarColor(groupId).fg`). Never assign these colors manually or add a seventh — the rotation and the "same person/group always looks the same" guarantee depend on the fixed 6-color array and the hash function staying put.

## Typography

**Display Font:** RobotoCondensed_900Black (with system sans-serif fallback)
**Body/UI Font:** System default (San Francisco on iOS, Roboto on Android, system-ui on web) — no custom body font is loaded.

**Character:** A single condensed, ultra-black display face reserved for one moment (the group name on its hero) against an otherwise all-system-font UI that gets its entire hierarchy from weight (700/800) and size, not font pairing. This is deliberate restraint, not an oversight — introducing a second custom font elsewhere would dilute the one place a display face currently commands real attention.

### Hierarchy
- **Display** (900, 44px, uppercase, centered): Group name on its hero banner — the only place RobotoCondensed_900Black appears.
- **Title** (800, 17–18px): Card and section titles ("🏆 The Standings", "🔥 Power Rankings", "🔒 Weekend Locks").
- **Label** (700–800, 11–13px, often uppercase with letter-spacing): Column headers, eyebrows, badges, timestamps.
- **Body** (700, 13px): Default UI text — member names, pick descriptions, chat messages. Note there is effectively no "body" weight below 700 anywhere in the product.

### Named Rules
**The No-Regular-Weight Rule.** Nothing in the product renders below font-weight 700. If a new component needs a lighter touch, reach for a lighter *color* (Ink Soft/Faint), not a lighter weight — dropping to 400/500 will read as a foreign, off-brand typographic voice.

## Layout

Single-column, card-stacked layout throughout (`gap: 16` between cards on the group page). No sidebar, no multi-column desktop layout — the product is built mobile-first via Expo Router web export and simply centers/stacks on wider viewports rather than adopting a distinct desktop grid. Horizontal scrolling is used deliberately inside two data-dense components (the Weekly Locks grid, the group leaderboard on narrow screens) rather than wrapping or truncating columns.

## Elevation & Depth

Currently almost entirely flat: surfaces are distinguished by a 1px hairline border (#E5E7EB) and white/sunken fill, not shadow. The one exception is the hero's two big NFL/CFB pick CTA buttons, which carry a soft shadow (`shadowOpacity: 0.18, shadowRadius: 10, elevation: 4`) specifically to read as the most tappable things on the page, plus a matching auth-card shadow on sign-in/reset.

Per confirmed direction, this is intentionally being opened up going forward — more shadow/lift is invited on card surfaces like Standings and Power Rankings to give the product more dimensional, trophy-case weight, rather than staying confined to just the two hero buttons.

### Shadow Vocabulary
- **CTA lift** (`shadowColor: #000, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: {0,4}, elevation: 4`): The hero's primary tap targets and other newly-elevated primary surfaces.
- **Auth lift** (`shadowColor: #000, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: {0,8}, elevation: 8`): Sign-in/reset cards — a softer, deeper variant.

## Shapes

**The Pill-or-Twelve Rule.** Interactive chips, badges, and buttons are pill-shaped (999px radius) with no in-between; structural containers (cards, panels) use a flat 12px radius. A handful of smaller controls (tabs, small buttons) use 8px. Nothing in the product uses a small "slightly rounded" radius like 4–6px for a primary surface — the two governing radii are "fully round" and "12."

## Components

### Buttons
- **Shape:** Pill (999px) for all standalone action buttons (Refresh scores, Share invite, copy).
- **Primary:** Turf Teal fill, white text, 700 weight, compact padding (6–10px vertical, 12–16px horizontal).
- **Secondary/Ghost:** White or transparent fill with a Turf Teal border and Turf Teal text — used for lower-emphasis actions (Back to group, secondary tabs).
- **Hero CTA (signature):** Larger white rounded-20 card buttons (the NFL/CFB pick entry points) with icon, title, and status subtext stacked — the one button style that gets a shadow. Disabled state swaps to flat `#EBEDF2` fill rather than dimming opacity (opacity-based disabling was tried and rejected — it muddied against the dark hero).

### Chips / Badges
- **Rank badge (Power Rankings):** Small dark-ink pill (`#0F172A` fill, white text) showing "#N" next to a member's name in the countdown.
- **Vibe chip (Standings):** Plain muted-slate text, no background — "🔥 Heater" / "🥶 Ice cold", shown only once a member has 3+ decided games.
- **Second-lock badge (Weekly Locks grid):** Tiny dark circular overlay badge ("2") on a pick cell during CFB gap weeks, marking a second lock in the NFL column.
- **Started badge (picks page):** Small pill marking a game that's already kicked off and can no longer be picked.

### Cards / Containers
- **Corner Style:** 12px radius, consistently.
- **Background:** White (`#FFFFFF`), 1px `#E5E7EB` border, no shadow.
- **Internal Padding:** 12px, `gap: 4` between header and body.
- **Header pattern:** Title (800 weight) left, an optional pill action button (Refresh, Share) right, on one row.

### Weekly Locks Grid (signature component)
A season-long spreadsheet-style tracker: one row per week, one NCAA/NFL sub-column pair per member, each cell colored by result (Win/Loss/Pending) with the pick text inside. This is the app's most data-dense surface and intentionally keeps the spreadsheet metaphor the group used before the app existed — it should stay legible and grid-like even as other surfaces get bolder.

### Power Rankings (signature component)
A countdown list, #1 first, one AI-generated roast paragraph per member with a rank badge and avatar. This is the product's actual differentiator — the visual treatment here should carry the most personality of any surface in the app.

### Navigation
Minimal top bar (Groups / Account / Sign in-out), no persistent bottom tab bar observed. Screen-level navigation is mostly link-driven (group cards → group dashboard → picks pages) rather than a tab paradigm.

## Do's and Don'ts

### Do:
- **Do** import brand color from `lib/theme.ts` (`colors.brand` = Turf Teal) rather than hardcoding `#0B735F` — the file exists specifically to prevent color drift, but most product screens still hardcode the hex directly instead of importing it.
- **Do** keep every avatar/identity color assignment flowing through `lib/avatar.ts`'s hash function — never hand-pick an identity color.
- **Do** keep text at 700 weight or heavier everywhere; use color (Ink Soft/Faint), not weight, to de-emphasize.
- **Do** treat the Power Rankings and Weekly Locks grid as the two surfaces most worth investing extra craft in — they're what members actually open the app to see.

### Don't:
- **Don't** introduce a second display font. RobotoCondensed_900Black's whole value is its rarity — it's currently used in exactly one place.
- **Don't** use opacity to indicate a disabled state on a solid-colored surface — it blends into whatever's behind it (this was a real bug, fixed by swapping to a flat muted fill instead).
- **Don't** add a seventh identity color or reorder the existing six — the hash math and every existing user/group's color assignment depends on the array staying fixed.
- **Don't** let the felt/brass palette and the teal/slate palette drift further apart without a decision — right now they're two different systems in the same codebase, not one system with room to grow.
