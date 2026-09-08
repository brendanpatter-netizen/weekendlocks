// components/LiveIcon.tsx
// An authored "on air" signal icon for "The Whiteboard" world — a dot with
// two radiating arcs, drawn as the same thick rounded marker stroke as
// LockIcon so it reads as sketched rather than a stock glyph. Used where a
// section is about something happening live right now (the group's Live
// Board), where the padlock's "picks are locked" meaning doesn't apply.
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export default function LiveIcon({ size = 20, color = "#F5F3E7" }: { size?: number; color?: string }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ opacity: pulse }}>
      <Circle cx="12" cy="12" r="2.5" fill={color} />
      <Path d="M7.5 8.5a6 6 0 0 0 0 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M16.5 8.5a6 6 0 0 1 0 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M4.5 5.5a10.5 10.5 0 0 0 0 13" stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={0.55} />
      <Path d="M19.5 5.5a10.5 10.5 0 0 1 0 13" stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={0.55} />
    </AnimatedSvg>
  );
}
