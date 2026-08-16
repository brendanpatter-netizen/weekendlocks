// components/TrophyIcon.tsx
// An authored trophy icon for "The Whiteboard" world — replaces the 🏆
// emoji. Drawn as a thick rounded marker stroke, matching LockIcon.
import Svg, { Path } from "react-native-svg";

export default function TrophyIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5 2.5 2.5 0 0 0 5.5 9H7"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 5h2.5A1.5 1.5 0 0 1 21 6.5 2.5 2.5 0 0 1 18.5 9H17"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 13v3" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M9 20h6" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
