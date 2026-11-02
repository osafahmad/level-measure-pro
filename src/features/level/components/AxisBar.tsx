import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import { axisFraction, formatSigned } from '../math/levelMath';
import { colors, ltr, radius, space, type } from '../theme/tokens';
import { AnimatedText } from './AnimatedText';
import { BUBBLE_SPRING, useFollow } from './useFollow';

const MARKER_W = 4;

type Props = { value: SharedValue<number>; label: string; color: SharedValue<string> };

/** `X` / `Y` label, track (±5°) with center mark and marker, signed value. */
export function AxisBar({ value, label, color }: Props) {
  const [trackW, setTrackW] = useState(0);
  const reduceMotion = useReducedMotion();
  const frac = useFollow(
    () => {
      'worklet';
      return axisFraction(value.value);
    },
    BUBBLE_SPRING,
    reduceMotion,
  );
  const marker = useAnimatedStyle(() => ({
    backgroundColor: color.value,
    transform: [{ translateX: frac.value * (trackW / 2 - MARKER_W) }],
  }));
  const text = useDerivedValue(() => `${formatSigned(value.value, 2)}°`);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track} onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
        <View style={styles.center} />
        <Animated.View style={[styles.marker, { left: trackW / 2 - MARKER_W / 2 }, marker]} />
      </View>
      <AnimatedText text={text} style={styles.value} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, direction: 'ltr' },
  label: { ...type.valueSm, color: colors.textMuted, width: 14, ...ltr },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    justifyContent: 'center',
  },
  center: { position: 'absolute', left: '50%', marginLeft: -0.5, width: 1, height: 16, backgroundColor: colors.mark },
  marker: { position: 'absolute', width: MARKER_W, height: 16, borderRadius: 2 },
  value: { ...type.valueSm, color: colors.text, width: 70, textAlign: 'right' },
});
