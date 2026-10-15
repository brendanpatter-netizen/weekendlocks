// lib/payout.ts
// Notional $ payout for a graded pick — "what would this have paid at a
// real sportsbook" using the actual American odds captured on the pick
// at the time it was made (picks.price), against a fixed $100 stake per
// lock. Not a real bankroll: every pick is its own independent $100, win
// or lose, never compounding — the fixed size is what keeps this a
// season-long scoreboard rather than a staking simulator.
export const STAKE = 100;

export type PickResult = "win" | "loss" | "push" | null;

// Standard American-odds payout: a negative price is the favorite's "bet
// this much to win $100" quote, a positive price is the underdog's "a
// $100 bet wins this much" quote.
export function payout(price: number | null | undefined, result: PickResult): number {
  if (result == null || price == null || !Number.isFinite(price)) return 0; // not graded yet
  if (result === "push") return 0;
  if (result === "loss") return -STAKE;
  return price < 0 ? STAKE * (100 / Math.abs(price)) : STAKE * (price / 100);
}

export function formatMoney(amount: number): string {
  const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`;
}
