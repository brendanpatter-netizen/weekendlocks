// lib/events.ts
import EventEmitter from "eventemitter3";

export type PickSavedPayload = {
  league: "nfl" | "cfb";
  week: number;
  game_id: number;
  user_id: string;
  pick_team: string;
  /** <-- NEW: optional because not all saves are in a group */
  group_id?: string | null;
};

class Events {
  private ee = new EventEmitter();

  emitPickSaved(payload: PickSavedPayload) {
    this.ee.emit("pick:saved", payload);
  }

  onPickSaved(cb: (p: PickSavedPayload) => void) {
    this.ee.on("pick:saved", cb);
    return () => this.ee.off("pick:saved", cb);
  }
}

export const events = new Events();
