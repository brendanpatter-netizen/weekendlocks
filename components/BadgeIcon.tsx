// components/BadgeIcon.tsx
// The drawable form of every id in lib/badges.ts — same authored-stroke
// grammar as LockIcon/TrophyIcon/FlameIcon (unfilled shapes, strokeWidth
// ~2.2-2.4, rounded caps/joins) so a member's chosen badge reads as part of
// the same hand-drawn icon family, not a bolted-on sticker set. Trophy and
// Flame are the two existing section icons, reused as-is rather than
// redrawn, so a badge choice never looks visually inconsistent with what
// those glyphs already mean elsewhere in the product.
import Svg, { Circle, Line, Path } from "react-native-svg";
import TrophyIcon from "@/components/TrophyIcon";
import FlameIcon from "@/components/FlameIcon";
import type { BadgeId } from "@/lib/badges";

type Props = { id: BadgeId; size?: number; color?: string };

export default function BadgeIcon({ id, size = 20, color = "#F5F3E7" }: Props) {
  if (id === "trophy") return <TrophyIcon size={size} color={color} />;
  if (id === "flame") return <FlameIcon size={size} color={color} />;

  const stroke = { stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {id === "star" && (
        <Path d="M12 3l2.4 5.9 6.4.5-4.9 4.1 1.6 6.2L12 16.9l-5.5 2.8 1.6-6.2-4.9-4.1 6.4-.5L12 3Z" {...stroke} />
      )}
      {id === "lightning" && (
        <Path d="M13 3 5 14h5l-1 7 8-11h-5l1-7Z" {...stroke} />
      )}
      {id === "target" && (
        <>
          <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2.2} fill="none" />
          <Circle cx={12} cy={12} r={4.3} stroke={color} strokeWidth={2.2} fill="none" />
          <Circle cx={12} cy={12} r={1.1} fill={color} />
        </>
      )}
      {id === "crown" && (
        <>
          <Path d="M4 17 5 9l3.5 3.5L12 6l3.5 6.5L19 9l1 8Z" {...stroke} />
          <Line x1={4} y1={20} x2={20} y2={20} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
      {id === "shield" && (
        <Path d="M12 3.2 19 6v6c0 5-3 7.8-7 8.8-4-1-7-3.8-7-8.8V6l7-2.8Z" {...stroke} />
      )}
      {id === "horseshoe" && (
        <>
          <Path d="M7 5v8a5 5 0 0 0 10 0V5" stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <Circle cx={7} cy={6.6} r={1} fill={color} />
          <Circle cx={17} cy={6.6} r={1} fill={color} />
        </>
      )}
      {id === "football" && (
        // Flattened past a circular lens so it doesn't read as an eye — an
        // American football drawn level is always wider than tall, never
        // round. Not flattened all the way, though: too thin and the top
        // and bottom strokes visually merge into a solid blob at badge
        // size. No tilt (see The Accent-Only Tilt Rule).
        <>
          <Path d="M2 12Q12 6 22 12Q12 18 2 12Z" {...stroke} />
          <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Line x1={9} y1={9.5} x2={9} y2={14.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Line x1={12} y1={9} x2={12} y2={15} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Line x1={15} y1={9.5} x2={15} y2={14.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
      {id === "megaphone" && (
        <>
          <Path d="M3 10v4h2l6 3V7l-6 3H3Z" {...stroke} />
          <Path d="M14.5 8.5c1.8 1.5 1.8 5.5 0 7" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
          <Path d="M17 6.5c3 2.5 3 8.5 0 11" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
        </>
      )}
      {id === "dumbbell" && (
        <>
          <Line x1={5} y1={7.5} x2={5} y2={16.5} stroke={color} strokeWidth={3} strokeLinecap="round" />
          <Line x1={19} y1={7.5} x2={19} y2={16.5} stroke={color} strokeWidth={3} strokeLinecap="round" />
          <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
      {id === "clover" && (
        <>
          <Circle cx={9.2} cy={9.2} r={3.4} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={14.8} cy={9.2} r={3.4} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={9.2} cy={14.8} r={3.4} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={14.8} cy={14.8} r={3.4} stroke={color} strokeWidth={2} fill="none" />
          <Line x1={12} y1={16} x2={12} y2={21} stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
