import React, { useEffect } from 'react';
import Svg, { Path, G, Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

// Make SVG components animatable
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

export const ProcessingLoader = ({
  size = 100,
  color = '#3B82F6',
}: {
  size?: number;
  color?: string;
}) => {
  const rotation = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    // Continuous rotation
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
    // Pulse effect
    progress.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [rotation, progress]);

  const animatedProps = useAnimatedProps(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0, 1], [120, 30]),
    opacity: interpolate(progress.value, [0, 1], [0.4, 1]),
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <AnimatedG origin="50, 50" animatedProps={animatedProps}>
        <Circle
          cx="50"
          cy="50"
          r="40"
          stroke={color}
          strokeWidth="8"
          opacity="0.2"
          fill="none"
        />
        <AnimatedPath
          d="M50 10 A 40 40 0 0 1 90 50"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="120"
          animatedProps={pathProps}
        />
      </AnimatedG>
    </Svg>
  );
};
