import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatPrimary, levelState, type Units } from '../math/levelMath';
import type { Reading } from '../state/readingsStore';
import { colors, ltr, space, type } from '../theme/tokens';

const STATE_COLOR = { ok: colors.ok, warn: colors.warn, bad: colors.bad };

export function formatReadingTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} · ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

type Props = {
  reading: Reading;
  tolerance: number;
  units: Units;
  onPress?: () => void;
  divider?: boolean;
};

/** Name + mono meta line + value colored by level state. */
export function ReadingRow({ reading, tolerance, units, onPress, divider }: Props) {
  const { t } = useTranslation();
  const color = STATE_COLOR[levelState(Math.abs(reading.angle), tolerance, false)];
  const modeLabel = t(`mode.${reading.mode === 'flat' ? 'flatUpper' : 'edgeUpper'}`);
  const value = formatPrimary(reading.angle, units);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${reading.name}, ${value}`}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {reading.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {modeLabel} · {formatReadingTime(reading.createdAt)}
        </Text>
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.md, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 3 },
  name: { ...type.body, fontFamily: type.button.fontFamily, color: colors.text },
  meta: { ...type.diag, color: colors.textMuted },
  value: { ...type.value, ...ltr },
});
