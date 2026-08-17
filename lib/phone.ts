// lib/phone.ts
// US-only for now: 10 digits -> +1XXXXXXXXXX (E.164). Already-E.164 input
// (starts with +) passes through untouched. Shared by the login page's
// phone sign-in and the account page's "add a phone number" flow.
export function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}
