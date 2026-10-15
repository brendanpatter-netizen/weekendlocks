// components/DollarIcon.tsx
// An authored dollar-sign icon for "The Whiteboard" world, matching
// LockIcon/TrophyIcon/FlameIcon's stroke grammar (unfilled shapes,
// strokeWidth ~2.2-2.4, rounded caps/joins) — for the Bankroll card.
import Svg, { Path } from "react-native-svg";

export default function DollarIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 7.5c0-1.9-2-3.2-4.5-3.2S7.5 5.6 7.5 7.5c0 4 9 2.3 9 6.3 0 1.9-2 3.4-4.5 3.4S7.5 16.1 7.5 14.2"
        stroke={color}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 2.5v19" stroke={color} strokeWidth={2.3} strokeLinecap="round" />
    </Svg>
  );
}
