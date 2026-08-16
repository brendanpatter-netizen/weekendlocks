// components/LockIcon.tsx
// An authored padlock icon for "The Whiteboard" world — replaces the 🔒
// emoji used elsewhere in the product. Drawn as a thick rounded marker
// stroke (not filled), so it reads as sketched rather than a stock glyph.
import Svg, { Path, Rect } from "react-native-svg";

export default function LockIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect
        x="4.5" y="10" width="15" height="10.5" rx="2.5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Path
        d="M12 14.5v3"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
