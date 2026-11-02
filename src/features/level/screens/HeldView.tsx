import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ReadingRow } from '../components/ReadingRow';
import {
  compass,
  formatPrimary,
  formatRatio,
  formatSigned,
  overLength,
  risePerMeter,
  roundHintMm,
  slopePercent,
  type Units,
} from '../math/levelMath';
import type { Mode } from '../sensors/useLevelSensor';
import type { Reading } from '../state/readingsStore';
import { colors, ltr, radius, size, space, type } from '../theme/tokens';

export type HeldReading = {
  mode: Mode;
  /** Edge: signed roll. Flat: total tilt. */
  angle: number;
  x: number;
  y: number;
  bearing: number;
  sigma: number;
  samples: number;
  time: Date;
  /** Calibration offset in effect, already formatted. */
  offset: string;
};

export function HeldPill() {
  const { t } = useTranslation();
  const scale = useSharedValue(0.9);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 15 });
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.pill, style]} accessibilityLabel={t('hold.pill')}>
      <Lock color={colors.info} size={14} strokeWidth={1.8} />
      <Text style={styles.pillText}>{t('hold.pill')}</Text>
    </Animated.View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

type Props = {
  held: HeldReading;
  units: Units;
  tolerance: number;
  frameWidthMm: number;
  recent: Reading[];
  onSave: () => void;
  onRelease: () => void;
  onSeeAll: () => void;
};

/** Reading held (design-system.md § 3.4). Values are a frozen snapshot: no per-frame work here. */
export function HeldView({ held, units, tolerance, frameWidthMm, recent, onSave, onRelease, onSeeAll }: Props) {
  const { t } = useTranslation();
  const { angle, mode } = held;
  const time = `${pad(held.time.getHours())}:${pad(held.time.getMinutes())}:${pad(held.time.getSeconds())}`;
  const mm = overLength(angle, frameWidthMm);
  const level = Math.abs(angle) < tolerance;
  const direction = level
    ? t('hold.none')
    : mode === 'edge'
      ? t(angle > 0 ? 'hold.raiseLeft' : 'hold.raiseRight')
      : `${t('hold.raiseLow')} · ${compass(held.bearing)}`;

  const rows: [string, string][] = [
    [t('hold.angle'), `${mode === 'edge' ? formatSigned(angle, 2) : Math.abs(angle).toFixed(2)}°`],
    [t('hold.slope'), `${slopePercent(angle).toFixed(2)}%`],
    [t('hold.rise'), `${risePerMeter(angle).toFixed(1)} mm/m`],
    [t('hold.ratio'), formatRatio(angle)],
    [t('hold.correction', { cm: Math.round(frameWidthMm / 10) }), `${level ? '0' : roundHintMm(mm)} mm · ${direction}`],
    [t('hold.offset'), held.offset],
  ];

  return (
    <View>
      <Text style={styles.overline}>
        {t('hold.overline', { mode: t(mode === 'edge' ? 'mode.edgeUpper' : 'mode.flatUpper'), time })}
      </Text>
      <Text style={styles.readout} accessibilityRole="text">
        {formatPrimary(angle, units)}
      </Text>
      <Text style={styles.caption}>
        {t('hold.caption', { n: held.samples, sigma: held.sigma.toFixed(2) })}
      </Text>

      <View style={styles.card}>
        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.row, i > 0 && styles.divider]}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, styles.saved]}>
        <View style={styles.savedHead}>
          <Text style={styles.cardTitle}>{t('hold.savedTitle')}</Text>
          <Pressable onPress={onSeeAll} accessibilityRole="link" hitSlop={12} style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('hold.seeAll')}</Text>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <Text style={styles.empty}>{t('hold.noneSaved')}</Text>
        ) : (
          recent.map((r, i) => <ReadingRow key={r.id} reading={r} tolerance={tolerance} units={units} divider={i > 0} />)
        )}
      </View>

      <View style={styles.buttons}>
        <Pressable onPress={onSave} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.btnText}>{t('hold.save')}</Text>
        </Pressable>
        <Pressable onPress={onRelease} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.release, pressed && styles.releasePressed]}>
          <Text style={[styles.btnText, styles.releaseText]}>{t('hold.release')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.infoTint,
  },
  pillText: { ...type.button, fontSize: 13, color: colors.info },
  overline: { ...type.overline, color: colors.textMuted, marginTop: space.xxl, textAlign: 'center' },
  readout: { ...type.readoutHeld, color: colors.info, textAlign: 'center', ...ltr },
  caption: { ...type.diag, color: colors.textMuted, textAlign: 'center' },
  card: {
    marginTop: space.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.md, gap: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { ...type.body, fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  rowValue: { ...type.value, fontSize: 14, color: colors.text, ...ltr },
  saved: { marginTop: space.lg, paddingTop: space.md },
  savedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...type.cardTitle, color: colors.textSecondary },
  seeAll: { minHeight: size.touch, justifyContent: 'center' },
  seeAllText: { ...type.button, fontSize: 13, color: colors.info },
  empty: { ...type.body, fontSize: 13, color: colors.textFaint, paddingBottom: space.lg },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  btn: { flex: 1, height: size.primaryButton, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  pressed: { backgroundColor: colors.chip },
  release: { backgroundColor: colors.info },
  releasePressed: { opacity: 0.85 },
  btnText: { ...type.button, fontSize: 14, color: colors.text },
  releaseText: { color: colors.onInfo },
});
