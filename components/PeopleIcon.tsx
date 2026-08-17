// components/PeopleIcon.tsx
// An authored two-person icon — replaces Ionicons' "people-outline".
// Drawn as a thick rounded marker stroke, matching LockIcon/FlameIcon/TrophyIcon.
// See ArrowRightIcon.tsx for why: Ionicons glyphs don't render during
// static/server rendering, which breaks hydration on prerendered pages.
import Svg, { Path } from "react-native-svg";

export default function PeopleIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* back person, peeking out behind */}
      <Path
        d="M15.5 11.2a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z"
        stroke={color} strokeWidth={2} strokeLinejoin="round"
      />
      <Path
        d="M13.3 14.9c.9-.6 1.8-.9 2.7-.9 2.2 0 3.9 1.5 3.9 4.2"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      {/* front person */}
      <Path
        d="M8.3 11.6a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8Z"
        stroke={color} strokeWidth={2.4} strokeLinejoin="round"
      />
      <Path
        d="M3.5 19c0-3.1 2.1-4.7 4.8-4.7s4.8 1.6 4.8 4.7"
        stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}
