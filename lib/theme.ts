// lib/theme.ts
// Single source of truth for brand color. Before this file, auth/account
// screens used their own `colors = { primary: "#006241", ... }` object while
// every other screen used "#0B735F" — two different greens live at once.
// Everything should import from here instead of declaring a local palette.
export const colors = {
  felt: "#063D31", // dark grounds — hero bands, nav bar
  feltRaised: "#0A4C3D",
  brand: "#0B735F", // the one true primary — buttons, links, accents
  brandStrong: "#085041",
  brass: "#B3781F", // gold, text-safe (icons, links on light bg)
  brassFill: "#F2C266", // gold, fill (pills, badges)
  brassInk: "#4A3106", // text color to place on top of brassFill
  paper: "#F2F5EF", // page background
  paperRaised: "#FFFFFF", // card surfaces
  ink: "#0C1712", // body text
  inkSoft: "#45564C", // secondary text
  line: "#DAE3D8", // hairlines/borders
  good: "#2E8B57",
  warn: "#C2501B",
  crit: "#C0392B", // destructive actions, losses
} as const;
