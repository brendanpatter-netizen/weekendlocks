// components/ChartIcon.tsx
// An authored bar-chart icon — replaces Ionicons' "bar-chart-outline".
// Drawn as a thick rounded marker stroke, matching LockIcon/FlameIcon/TrophyIcon.
// See ArrowRightIcon.tsx for why: Ionicons glyphs don't render during
// static/server rendering, which breaks hydration on prerendered pages.
import Svg, { Path } from "react-native-svg";

export default function ChartIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 20V13" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M12 20V8" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M19 20V4" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
