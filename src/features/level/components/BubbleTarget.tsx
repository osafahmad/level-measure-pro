import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { targetOffset } from '../math/levelMath';
import { colors, fonts, size } from '../theme/tokens';
import { Fit } from './Fit';
import { BUBBLE_SPRING, useFollow } from './useFollow';

const D = size.target; // 260
const C = D / 2;
const B = size.bubbleFlat; // 44
const EDGE_TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

/** Rings at 5° / 3° / 1°, crosshair, edge ticks and ring labels. Drawn once. */
const TargetArt = memo(function TargetArtImpl() {
  return (
    <Svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={StyleSheet.absoluteFill}>
      <Line x1={C} y1={6} x2={C} y2={D - 6} stroke={colors.chip} strokeWidth={1} />
      <Line x1={6} y1={C} x2={D - 6} y2={C} stroke={colors.chip} strokeWidth={1} />
      <Circle cx={C} cy={C} r={115} stroke={colors.borderVial} strokeWidth={1} fill="none" />
      <Circle cx={C} cy={C} r={69} stroke={colors.borderVial} strokeWidth={1} fill="none" />
      <Circle cx={C} cy={C} r={23} stroke={colors.ok} strokeWidth={1} strokeDasharray="3 3" fill="none" />
      {EDGE_TICKS.map(deg => {
        const long = deg % 90 === 0;
        const th = (deg * Math.PI) / 180;
        const r1 = C - 2;
        const r2 = C - (long ? 12 : 6);
        return (
          <Line
            key={deg}
            x1={C + r1 * Math.sin(th)}
            y1={C - r1 * Math.cos(th)}
            x2={C + r2 * Math.sin(th)}
            y2={C - r2 * Math.cos(th)}
            stroke={long ? colors.tickMajor : colors.tickMinor}
            strokeWidth={long ? 1.5 : 1}
          />
        );
      })}
      <SvgText x={C + 84} y={C - 84} fontSize={10} fontFamily={fonts.mono} fill={colors.textFaint}>
        5°
      </SvgText>
      <SvgText x={C + 51} y={C - 51} fontSize={10} fontFamily={fonts.mono} fill={colors.textFaint}>
        3°
      </SvgText>
    </Svg>
  );
});

type Props = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  isLevel: SharedValue<boolean>;
  color: SharedValue<string>;
  accessibilityLabel?: string;
};

/** 260 px target; the bubble sits toward the high side (23 px per degree, clamped to 5°). */
export function BubbleTarget({ x, y, isLevel, color, accessibilityLabel }: Props) {
  const reduceMotion = useReducedMotion();
  const dx = useFollow(
    () => {
      'worklet';
      return targetOffset(x.value, y.value).dx;
    },
    BUBBLE_SPRING,
    reduceMotion,
  );
  const dy = useFollow(
    () => {
      'worklet';
      return targetOffset(x.value, y.value).dy;
    },
    BUBBLE_SPRING,
    reduceMotion,
  );

  const border = useAnimatedStyle(() => ({
    borderColor: withTiming(isLevel.value ? colors.ok : colors.borderVial, { duration: 150 }),
  }));
  const bubble = useAnimatedStyle(() => ({
    backgroundColor: color.value,
    transform: [{ translateX: dx.value }, { translateY: dy.value }],
  }));

  return (
    <Fit width={D} height={D}>
      <Animated.View style={[styles.disc, border]} accessible accessibilityLabel={accessibilityLabel}>
        <TargetArt />
        <Animated.View style={[styles.bubble, bubble]}>
          <View style={styles.shine} />
        </Animated.View>
        <View style={styles.reticle} />
      </Animated.View>
    </Fit>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: D,
    height: D,
    borderRadius: D / 2,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
  },
  bubble: {
    position: 'absolute',
    left: C - B / 2 - 1.5,
    top: C - B / 2 - 1.5,
    width: B,
    height: B,
    borderRadius: B / 2,
  },
  shine: {
    position: 'absolute',
    left: 10,
    top: 8,
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bubbleShine,
  },
  reticle: {
    position: 'absolute',
    left: C - 5 - 1.5,
    top: C - 5 - 1.5,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.text,
  },
});
