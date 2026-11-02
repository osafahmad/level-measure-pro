import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { LevelState } from '../math/levelMath';
import { colors, radius, space, type } from '../theme/tokens';

export type ChipState = LevelState | 'held';

const FG: Record<ChipState, string> = { ok: colors.ok, warn: colors.warn, bad: colors.bad, held: colors.info };
const BG: Record<ChipState, string> = {
  ok: colors.okTint,
  warn: colors.warnTint,
  bad: colors.badTint,
  held: colors.infoTint,
};

/** Pill with a dot and an instruction ("Raise left side 25 mm"). Text crossfades on change. */
export function HintChip({ text, state }: { text: string; state: ChipState }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = 0.25;
    opacity.value = withTiming(1, { duration: 150 });
  }, [text, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      style={[styles.chip, { backgroundColor: BG[state] }]}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}>
      <View style={[styles.dot, { backgroundColor: FG[state] }]} />
      <Animated.Text style={[styles.text, { color: FG[state] }, fade]} numberOfLines={1}>
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 32,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  text: { ...type.button, fontSize: 13, fontVariant: ['tabular-nums'] },
});
