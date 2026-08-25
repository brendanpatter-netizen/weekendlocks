// components/TotalsIcon.tsx
// Marks a totals pick (combined score over/under a line) in the season
// grid — an up arrow and a down arrow side by side. Matches LockIcon's
// authored, thick-rounded-stroke style.
import Svg, { Path } from "react-native-svg";

export default function TotalsIcon({ size = 14, color = "#64748B" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 18.5V6" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M4 9l3-3 3 3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 5.5V18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M20 15l-3 3-3-3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
