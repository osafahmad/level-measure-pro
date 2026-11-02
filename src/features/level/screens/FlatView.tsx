import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from 'lucide-react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AnimatedReadout } from '../components/AnimatedReadout';
import { AnimatedText } from '../components/AnimatedText';
import { AxisBar } from '../components/AxisBar';
import { BubbleTarget } from '../components/BubbleTarget';
import { TechPanel } from '../components/TechPanel';
import {
  compass,
  formatRatio,
  formatSigned,
  risePerMeter,
  slopePercent,
  wrap180,
} from '../math/levelMath';
import type { LevelSensor } from '../sensors/useLevelSensor';
import { colors, ltr, radius, space, type } from '../theme/tokens';

type Props = {
  s: LevelSensor;
  color: SharedValue<string>;
  offsetX: number;
  offsetY: number;
  relative: boolean;
};

/** Flat mode: total tilt + high side, bubble target, X/Y bars and technical data. */
export function FlatView({ s, color, offsetX, offsetY, relative }: Props) {
  const { t } = useTranslation();

  // High-side arrow: unwrapped so it turns the short way across 0°/360°.
  const arrowRot = useSharedValue(0);
  useAnimatedReaction(
    () => s.bearing.value,
    b => {
      arrowRot.value += wrap180(b - arrowRot.value);
    },
  );
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(s.wasLevel.value ? 0.25 : 1, { duration: 150 }),
    transform: [{ rotate: `${arrowRot.value}deg` }],
  }));
  const bearingText = useDerivedValue(() =>
    s.wasLevel.value ? '—' : `${compass(s.bearing.value)} ${Math.round(s.bearing.value)}°`,
  );

  const totalText = useDerivedValue(() => `${s.total.value.toFixed(2)}°`);
  const slope = useDerivedValue(() => `${slopePercent(s.total.value).toFixed(2)}%`);
  const rise = useDerivedValue(() => `${risePerMeter(s.total.value).toFixed(1)} mm/m`);
  const ratio = useDerivedValue(() => formatRatio(s.total.value));
  const header = useDerivedValue(() => `σ ${s.sigma.value.toFixed(2)}° · g ${s.g.value.toFixed(2)}`);

  return (
    <View>
      <View style={styles.top}>
        <View style={styles.left}>
          <View style={styles.overlineRow}>
            <Text style={styles.overline}>{t('overline.flat')}</Text>
            {relative ? <Text style={styles.rel}>{t('overline.rel')}</Text> : null}
          </View>
          <AnimatedReadout value={s.total} units={s.units} color={color} style={styles.readout} />
        </View>
        <View style={styles.right}>
          <Text style={styles.label}>{t('flat.highSide')}</Text>
          <View style={styles.compassRow}>
            <Animated.View style={[styles.arrow, arrowStyle]}>
              <ArrowUp color={colors.text} size={18} strokeWidth={1.8} />
            </Animated.View>
            <AnimatedText text={bearingText} style={styles.bearing} />
          </View>
        </View>
      </View>

      <View style={styles.target}>
        <BubbleTarget x={s.flatX} y={s.flatY} isLevel={s.wasLevel} color={color} accessibilityLabel={t('a11y.target')} />
      </View>

      <View style={styles.bars}>
        <AxisBar value={s.flatX} label="X" color={color} />
        <AxisBar value={s.flatY} label="Y" color={color} />
      </View>
      <Text style={styles.long}>{t('hint.longSurface')}</Text>

      <View style={styles.panel}>
        <TechPanel
          title={t('panel.title')}
          status={header}
          cells={[
            { key: 'total', label: t('panel.total'), value: totalText },
            { key: 'slope', label: t('panel.slope'), value: slope },
            { key: 'rise', label: t('panel.rise'), value: rise },
            { key: 'ratio', label: t('panel.ratio'), value: ratio },
            { key: 'ox', label: t('panel.offsetX'), value: `${formatSigned(offsetX, 2)}°` },
            { key: 'oy', label: t('panel.offsetY'), value: `${formatSigned(offsetY, 2)}°` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.xl },
  left: { gap: 2 },
  right: { alignItems: 'flex-end', gap: 6, paddingBottom: space.sm },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  overline: { ...type.overline, color: colors.textMuted },
  rel: {
    ...type.overline,
    fontSize: 10,
    color: colors.info,
    backgroundColor: colors.infoTint,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  readout: { ...type.readoutL, height: 62, textAlign: 'left' },
  label: { ...type.label, color: colors.textMuted },
  compassRow: { flexDirection: 'row', alignItems: 'center', gap: 6, direction: 'ltr' },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bearing: { ...type.value, color: colors.text, minWidth: 70, textAlign: 'right', ...ltr },
  target: { marginTop: space.lg },
  bars: { marginTop: space.lg, gap: space.sm },
  long: { ...type.label, color: colors.textFaint, marginTop: space.sm, textAlign: 'center' },
  panel: { marginTop: space.lg },
});
