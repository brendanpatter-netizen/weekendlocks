// components/FlameIcon.tsx
// An authored flame icon for "The Whiteboard" world — replaces the 🔥
// emoji. Drawn as a thick rounded marker stroke, matching LockIcon.
import Svg, { Path } from "react-native-svg";

export default function FlameIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c-1.5 3-4.5 5-4.5 9a4.5 4.5 0 0 0 9 0c0-1.2-.4-2.1-1-3 0 1.5-1 2.5-2 2.5a1.8 1.8 0 0 1-1.8-1.8c0-2 1.8-3 .3-6.7Z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
