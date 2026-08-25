// components/MoneylineIcon.tsx
// Marks a moneyline pick (team just has to win, no margin) in the season
// grid — two arrows meeting head-on, for a straight head-to-head matchup.
// Matches LockIcon's authored, thick-rounded-stroke style.
import Svg, { Path } from "react-native-svg";

export default function MoneylineIcon({ size = 14, color = "#64748B" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 12h6.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M7 9l3 3-3 3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20.5 12h-6.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M17 9l-3 3 3 3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
