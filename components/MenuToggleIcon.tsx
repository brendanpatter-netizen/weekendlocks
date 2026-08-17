// components/MenuToggleIcon.tsx
// An authored hamburger/close icon — replaces Ionicons' "menu-outline"/"close".
// Drawn as a thick rounded marker stroke, matching LockIcon/FlameIcon/TrophyIcon.
// Lives in the header (app/_layout.tsx), which every non-auth route shares —
// Ionicons glyphs don't render during static/server rendering, so this one
// icon alone was throwing a hydration mismatch on every page. See
// ArrowRightIcon.tsx for the full explanation.
import Svg, { Path } from "react-native-svg";

export default function MenuToggleIcon({
  open, size = 20, color = "#F5F3E7",
}: { open: boolean; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {open ? (
        <>
          <Path d="M6 6l12 12" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M18 6L6 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Path d="M4 7h16" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M4 12h16" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M4 17h16" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
