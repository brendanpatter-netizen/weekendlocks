// lib/badges.ts
// The curated set of profile badges a member can pick on the Account page
// (see components/BadgeIcon.tsx for the drawings). A fixed, small list —
// same reasoning as the six member-identity colors never growing a
// seventh: a known, bounded set is easy to render everywhere without a
// fallback for an arbitrary user-supplied value. Order here is picker order.
export const BADGE_IDS = [
  "trophy",
  "flame",
  "star",
  "lightning",
  "target",
  "crown",
  "shield",
  "horseshoe",
  "football",
  "megaphone",
  "dumbbell",
  "clover",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export function isBadgeId(v: unknown): v is BadgeId {
  return typeof v === "string" && (BADGE_IDS as readonly string[]).includes(v);
}
