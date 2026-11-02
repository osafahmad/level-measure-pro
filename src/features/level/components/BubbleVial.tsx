import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { vialOffset } from '../math/levelMath';
import { colors, radius, size } from '../theme/tokens';
import { Fit } from './Fit';
import { BUBBLE_SPRING, useFollow } from './useFollow';

const W = 350;
const H = size.vialHeight; // 56
const BUBBLE_LEFT = 131;

const Marks = memo(function MarksImpl() {
  return (
    <>
      <View style={[styles.mark, styles.markLeft]} />
      <View style={[styles.mark, styles.markRight]} />
    </>
  );
});

type Props = {
  angle: SharedValue<number>;
  velocity: SharedValue<number>;
  isLevel: SharedValue<boolean>;
  color: SharedValue<string>;
  accessibilityLabel?: string;
};

/** Horizontal tube 350×56; the bubble moves toward the higher side and stretches with speed. */
export function BubbleVial({ angle, velocity, isLevel, color, accessibilityLabel }: Props) {
  const reduceMotion = useReducedMotion();
  const x = useFollow(
    () => {
      'worklet';
      return vialOffset(angle.value);
    },
    BUBBLE_SPRING,
    reduceMotion,
  );

  const border = useAnimatedStyle(() => ({
    borderColor: withTiming(isLevel.value ? colors.ok : colors.borderVial, { duration: 150 }),
  }));

  const bubble = useAnimatedStyle(() => {
    const sx = reduceMotion ? 1 : 1 + Math.min(Math.abs(velocity.value) * 0.004, 0.25);
    return {
      backgroundColor: color.value,
      transform: [{ translateX: x.value }, { scaleX: sx }, { scaleY: 1 / Math.sqrt(sx) }],
    };
  });

  return (
    <Fit width={W} height={H}>
      <Animated.View style={[styles.tube, border]} accessible accessibilityLabel={accessibilityLabel}>
        <Marks />
        <Animated.View style={[styles.bubble, bubble]}>
          <View style={styles.shine} />
        </Animated.View>
      </Animated.View>
    </Fit>
  );
}

const styles = StyleSheet.create({
  tube: {
    width: W,
    height: H,
    borderRadius: radius.vial,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
  },
  mark: { position: 'absolute', top: (H - 3 - 40) / 2, width: 2, height: 40, backgroundColor: colors.mark },
  markLeft: { left: 129 },
  markRight: { left: 217 },
  bubble: {
    position: 'absolute',
    top: 7 - 1.5,
    left: BUBBLE_LEFT - 1.5,
    width: size.bubbleEdgeW,
    height: size.bubbleEdgeH,
    borderRadius: 20,
  },
  shine: {
    position: 'absolute',
    left: 14,
    top: 5,
    width: 26,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bubbleShine,
  },
});
