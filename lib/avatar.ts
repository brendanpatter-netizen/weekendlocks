// lib/avatar.ts
// Deterministic avatar color + initials per user, shared by the group
// dashboard and group chat so the same person always looks the same.
export const AVATAR_COLORS = [
  { bg: "#E1F5EE", fg: "#085041" },
  { bg: "#FAECE7", fg: "#712B13" },
  { bg: "#EEEDFE", fg: "#3C3489" },
  { bg: "#E6F1FB", fg: "#0C447C" },
  { bg: "#FBEAF0", fg: "#72243E" },
  { bg: "#FAEEDA", fg: "#633806" },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarColor(id: string) {
  return AVATAR_COLORS[hashStr(id) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
