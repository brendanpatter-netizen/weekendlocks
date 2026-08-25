// components/SpreadIcon.tsx
// Marks a spread pick (team wins/covers by X points) in the season grid —
// a plus over a minus, since a spread bet is fundamentally "add or
// subtract points before comparing scores." Matches LockIcon's authored,
// thick-rounded-stroke style.
import Svg, { Path } from "react-native-svg";

export default function SpreadIcon({ size = 14, color = "#64748B" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4.5v5" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M9.5 7h5" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M9.5 17.5h5" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
