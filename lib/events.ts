// lib/events.ts
export type PickSavedPayload = {
  league: "nfl" | "cfb";
  week: number;
  game_id: number;
  user_id: string;
  pick_team: string;
};

type Handler = (p: PickSavedPayload) => void;

const handlers = new Set<Handler>();

export const events = {
  onPickSaved(handler: Handler) {
    handlers.add(handler);
    // ✅ return a cleanup that is () => void (not boolean)
    return () => {
      handlers.delete(handler);
    };
  },
  emitPickSaved(payload: PickSavedPayload) {
    for (const h of handlers) h(payload);
  },
};
