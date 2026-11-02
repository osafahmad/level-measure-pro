import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { AnimatedText } from '../components/AnimatedText';
import { colors, radius, space, type } from '../theme/tokens';
import type { LevelSensor } from './useLevelSensor';

const fmt = (v: number) => {
  'worklet';
  return (v >= 0 ? '+' : '') + v.toFixed(3);
};

/** __DEV__ only: raw and normalized x, y, z for the pose test (sensor-math.md § 2). */
export function DebugOverlay({ s }: { s: LevelSensor }) {
  const source = s.usingAccel ? 'ACCEL' : s.available ? 'GRAVITY' : 'NO SENSOR';
  const text = useDerivedValue(() => {
    const r = s.rawSensor.value;
    const n = s.rawU.value;
    const f = s.f.value;
    return (
      `${source}  ${s.mode.value.toUpperCase()}${s.auto.value ? ' auto' : ' pinned'}  q=${s.q.value}\n` +
      `raw  x ${fmt(r.x)}  y ${fmt(r.y)}  z ${fmt(r.z)}\n` +
      `norm x ${fmt(n.x)}  y ${fmt(n.y)}  z ${fmt(n.z)}\n` +
      `filt x ${fmt(f.x)}  y ${fmt(f.y)}  z ${fmt(f.z)}\n` +
      `edge ${fmt(s.edge.value)}°  X ${fmt(s.flatX.value)}°  Y ${fmt(s.flatY.value)}°`
    );
  });
  if (!__DEV__) return null;
  return (
    <View pointerEvents="none" style={styles.box}>
      <AnimatedText text={text} style={styles.text} multiline />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    top: 120,
    padding: space.sm,
    borderRadius: radius.cell,
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.info,
    zIndex: 10,
  },
  text: { ...type.diag, color: colors.info, lineHeight: 16 },
});
