// components/LocateIcon.tsx
// An authored crosshair/target icon — replaces Ionicons' "locate-outline".
// Drawn as a thick rounded marker stroke, matching LockIcon/FlameIcon/TrophyIcon.
// See ArrowRightIcon.tsx for why: Ionicons glyphs don't render during
// static/server rendering, which breaks hydration on prerendered pages.
import Svg, { Path } from "react-native-svg";

export default function LocateIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke={color} strokeWidth={2.2} strokeLinejoin="round"
      />
    </Svg>
  );
}
