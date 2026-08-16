// components/TapeCorner.tsx
// A small piece of "masking tape" pinning a card to the board — used across
// every card in "The Whiteboard" world so the paper-pinned-to-board language
// stays consistent whichever file the card lives in.
import { View, StyleSheet } from "react-native";

export default function TapeCorner({ side = "left" }: { side?: "left" | "right" }) {
  return <View style={[styles.tape, side === "right" && styles.tapeRight]} />;
}

const styles = StyleSheet.create({
  tape: {
    position: "absolute", top: -8, left: 16, width: 46, height: 18,
    backgroundColor: "rgba(244, 196, 48, 0.55)", borderWidth: 1, borderColor: "rgba(180, 140, 20, 0.35)",
    transform: [{ rotate: "-3deg" }], zIndex: 2,
  },
  tapeRight: { left: undefined, right: 16, transform: [{ rotate: "3deg" }] },
});
