import { useAnimatedReaction, useSharedValue, withSpring, withTiming, type WithSpringConfig } from 'react-native-reanimated';

export const BUBBLE_SPRING: WithSpringConfig = { damping: 14, stiffness: 180, mass: 0.6 };
export const NEEDLE_SPRING: WithSpringConfig = { damping: 18, stiffness: 220 };
export const ROTATION_SPRING: WithSpringConfig = { damping: 20, stiffness: 160 };
export const REDUCED_TIMING = { duration: 120 };

/**
 * A number that chases a per-frame target with a spring (or a short timing under Reduce Motion).
 * `compute` must be a worklet.
 */
export function useFollow(compute: () => number, spring: WithSpringConfig, reduceMotion: boolean) {
  const out = useSharedValue(0);
  useAnimatedReaction(compute, v => {
    out.value = reduceMotion ? withTiming(v, REDUCED_TIMING) : withSpring(v, spring);
  });
  return out;
}
