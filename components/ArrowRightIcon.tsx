// components/ArrowRightIcon.tsx
// An authored forward-arrow icon — replaces Ionicons' "arrow-forward".
// Drawn as a thick rounded marker stroke, matching LockIcon/FlameIcon/TrophyIcon.
// Ionicons' glyph fonts render empty during static/server rendering (the
// font isn't available in that environment) and only fill in after client
// hydration, which throws a React hydration-mismatch error — SVG paths
// render identically on both, so swapping to hand-drawn icons is what
// actually makes / and /how-it-works safe to prerender.
import Svg, { Path } from "react-native-svg";

export default function ArrowRightIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h15" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M13 6l6 6-6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
