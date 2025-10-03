import { Pressable, Text } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";

type PickPayload = {
  league: "NFL" | "CFB";
  week: number | string;
  gameId?: string;      // your games table id if you have it
  eventId?: string;     // sportsbook/odds id if you have that instead
  market: "spread" | "total" | "moneyline";
  side: string;         // e.g. "Rams", "Under"
  line?: number | string;
  price?: number | string; // e.g. -110
  book?: string;
};

type Props = {
  label: string;             // what the user sees on the button
  payload: PickPayload;      // what we save
  onPick: (p: PickPayload) => Promise<void>;
  disabled?: boolean;
};

export default function PickLink({ label, payload, onPick, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handlePress = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onPick(payload);           // 1) record the pick
    } catch (err) {
      console.error("record pick failed", err);
      // intentionally still route so the user can see state in Groups
    } finally {
      router.push("/groups");          // 2) route to Groups
    }
  };

  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={handlePress}
      className={`rounded-xl border px-3 py-2 ${disabled ? "opacity-40" : "hover:opacity-80"}`}
    >
      <Text>{busy ? "Saving…" : label}</Text>
    </Pressable>
  );
}
