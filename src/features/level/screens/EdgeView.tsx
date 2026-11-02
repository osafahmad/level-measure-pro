import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { AngleDial } from '../components/AngleDial';
import { AnimatedReadout } from '../components/AnimatedReadout';
import { HintChip } from '../components/HintChip';
import { BubbleVial } from '../components/BubbleVial';
import { TechPanel } from '../components/TechPanel';
import { ROTATION_SPRING } from '../components/useFollow';
import {
  edgePitch,
  formatRatio,
  formatSigned,
  overLength,
  risePerMeter,
  slopePercent,
  wrap180,
  type LevelState,
} from '../math/levelMath';
import type { LevelSensor } from '../sensors/useLevelSensor';
import { colors, radius, space, type } from '../theme/tokens';

const HAPTIC_STATUS_MS = 2500;

type Props = {
  s: LevelSensor;
  color: SharedValue<string>;
  state: LevelState;
  hint: number;
  stable: boolean;
  hapticSentAt: number;
  tolerance: number;
  frameWidthMm: number;
  offset: number;
  relative: boolean;
};

export function hintText(t: TFunction, hint: number, tolerance: number) {
  if (hint === 0) return t('hint.level', { tol: tolerance });
  return t(hint > 0 ? 'hint.raiseLeft' : 'hint.raiseRight', { mm: Math.abs(hint) });
}

/** Edge mode: dial, hint, vial (rotating with the down edge) and technical data. */
export function EdgeView({ s, color, state, hint, stable, hapticSentAt, tolerance, frameWidthMm, offset, relative }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  // Rotate the instrument so its text stays upright on whichever edge is down. CSS rotate is
  // clockwise-positive, so the spec's mathematical −90·q becomes +90·q here; take the shortest way.
  const target = useSharedValue(0);
  const rot = useSharedValue(0);
  useAnimatedReaction(
    () => s.q.value,
    (q, prev) => {
      target.value += wrap180(q * 90 - target.value);
      // First run (mount) snaps; later quarter turns animate.
      rot.value = reduceMotion || prev === null ? target.value : withSpring(target.value, ROTATION_SPRING);
    },
  );
  const rotStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const [, rerender] = useState(0);
  const showHaptic = Date.now() - hapticSentAt < HAPTIC_STATUS_MS;
  useEffect(() => {
    if (!showHaptic) return;
    const id = setTimeout(() => rerender(n => n + 1), HAPTIC_STATUS_MS);
    return () => clearTimeout(id);
  }, [showHaptic, hapticSentAt]);

  const angle = useDerivedValue(() => `${formatSigned(s.edge.value, 2)}°`);
  const slope = useDerivedValue(() => `${slopePercent(s.edge.value).toFixed(2)}%`);
  const ratio = useDerivedValue(() => formatRatio(s.edge.value));
  const rise = useDerivedValue(() => `${risePerMeter(s.edge.value).toFixed(1)} mm/m`);
  const over = useDerivedValue(() => `${overLength(s.edge.value, s.frameMm.value).toFixed(1)} mm`);
  const diag = useDerivedValue(
    () =>
      `ROLL ${formatSigned(s.edge.value, 2)}°  PITCH ${formatSigned(edgePitch(s.f.value), 2)}°  ` +
      `σ ${s.sigma.value.toFixed(2)}°  g ${s.g.value.toFixed(2)}`,
  );

  const status = showHaptic
    ? { text: t('panel.hapticSent'), tone: 'ok' as const }
    : stable
      ? { text: t('panel.stable'), tone: 'ok' as const }
      : { text: t('panel.settling'), tone: 'warn' as const };

  return (
    <View>
      <Animated.View style={[styles.instrument, rotStyle]}>
        <AngleDial angle={s.edge} tolerance={tolerance} color={color} accessibilityLabel={t('a11y.dial')}>
          <AnimatedReadout value={s.edge} units={s.units} color={color} style={styles.readout} />
          <View style={styles.overlineRow}>
            <Text style={styles.overline}>{t('overline.edge')}</Text>
            {relative ? <Text style={styles.rel}>{t('overline.rel')}</Text> : null}
          </View>
        </AngleDial>
        <View style={styles.chip}>
          <HintChip text={hintText(t, hint, tolerance)} state={state} />
        </View>
        <View style={styles.vial}>
          <BubbleVial
            angle={s.edge}
            velocity={s.velocity}
            isLevel={s.wasLevel}
            color={color}
            accessibilityLabel={t('a11y.vial')}
          />
        </View>
      </Animated.View>
      <View style={styles.panel}>
        <TechPanel
          title={t('panel.title')}
          status={status}
          cells={[
            { key: 'angle', label: t('panel.angle'), value: angle },
            { key: 'slope', label: t('panel.slope'), value: slope },
            { key: 'ratio', label: t('panel.ratio'), value: ratio },
            { key: 'rise', label: t('panel.rise'), value: rise },
            { key: 'over', label: t('panel.over', { cm: Math.round(frameWidthMm / 10) }), value: over },
            { key: 'offset', label: t('panel.offset'), value: `${formatSigned(offset, 2)}°` },
          ]}
          diagnostics={diag}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  instrument: { marginTop: space.xl },
  readout: { ...type.readoutXL, height: 76 },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, direction: 'ltr' },
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
  chip: { marginTop: 10 },
  vial: { marginTop: 18 },
  panel: { marginTop: space.lg },
});
