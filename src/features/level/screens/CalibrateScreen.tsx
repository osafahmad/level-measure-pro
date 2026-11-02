import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, RotateCw, Smartphone, X } from 'lucide-react-native';
import { useAnimatedReaction, useDerivedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedText } from '../components/AnimatedText';
import { IconButton } from '../components/IconButton';
import { formatSigned, toMs2, twoPointOffset } from '../math/levelMath';
import type { LevelScreenProps } from '../navigation';
import { haptics } from '../platform/haptics';
import { useLevel, useMeasuring } from '../sensors/LevelSensorContext';
import { STABLE_SIGMA, type Mode } from '../sensors/useLevelSensor';
import { useCalibration } from '../state/calibrationStore';
import { colors, ltr, radius, size, space, type } from '../theme/tokens';

const CAPTURE_STABLE_MS = 1000;

type Sample = { edge: number; x: number; y: number; q: number };
type Step = 1 | 2 | 'done';

export function CalibrateScreen({ navigation }: LevelScreenProps<'Calibrate'>) {
  useMeasuring('calibrate');
  const s = useLevel();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cal = useCalibration();

  const [mode, setMode] = useState<Mode>('edge');
  const [quarter, setQuarter] = useState(0);
  const [step, setStep] = useState<Step>(1);
  const [a, setA] = useState<Sample | null>(null);
  const [b, setB] = useState<Sample | null>(null);
  const [still, setStill] = useState(false);
  const [steady, setSteady] = useState(false);
  const [pending, setPending] = useState<'capture' | 'zero' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Calibrate the mode the phone is in when the screen opens (read after mount, not during render).
  useEffect(() => {
    setMode(s.mode.value);
  }, [s]);
  useAnimatedReaction(
    () => s.q.value,
    (q, prev) => {
      if (q !== prev) scheduleOnRN(setQuarter, q);
    },
  );
  useAnimatedReaction(
    () => s.sigma.value < STABLE_SIGMA,
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setStill, v);
    },
  );
  useAnimatedReaction(
    () => s.stableMs.value >= CAPTURE_STABLE_MS,
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setSteady, v);
    },
  );

  const sample = useCallback(
    (): Sample => ({ edge: s.slowEdgeRaw.value, x: s.slowFlatXRaw.value, y: s.slowFlatYRaw.value, q: s.q.value }),
    [s],
  );

  const capture = useCallback(() => {
    haptics.light();
    const v = sample();
    if (step === 1) {
      setA(v);
      setStep(2);
      return;
    }
    if (!a) return;
    setB(v);
    if (mode === 'flat') cal.setFlat(twoPointOffset(a.x, v.x), twoPointOffset(a.y, v.y), 'two-point');
    else cal.setEdge(a.q, twoPointOffset(a.edge, v.edge), 'two-point');
    setStep('done');
  }, [sample, step, a, mode, cal]);

  const zero = useCallback(() => {
    haptics.light();
    const v = sample();
    if (mode === 'flat') cal.setFlat(v.x, v.y, 'zero');
    else cal.setEdge(v.q, v.edge, 'zero');
    setMessage(t('calibrate.zeroDone'));
  }, [sample, mode, cal, t]);

  // Capture only after the reading has been stable for 1 s (sensor-math.md § 6).
  useEffect(() => {
    if (!pending || !steady) return;
    if (pending === 'capture') capture();
    else zero();
    setPending(null);
    setMessage(m => (m === t('calibrate.holdStill') ? null : m));
  }, [pending, steady, capture, zero, t]);

  const request = (what: 'capture' | 'zero') => {
    if (steady) {
      if (what === 'capture') capture();
      else zero();
      return;
    }
    setPending(what);
    setMessage(t('calibrate.holdStill'));
  };

  const onReset = () =>
    Alert.alert(t('settings.resetConfirmTitle'), t('settings.resetConfirmBody'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.reset'),
        style: 'destructive',
        onPress: () => {
          cal.reset();
          setStep(1);
          setA(null);
          setB(null);
          setMessage(t('calibrate.resetDone'));
        },
      },
    ]);

  const restart = () => {
    setStep(1);
    setA(null);
    setB(null);
    setMessage(null);
  };

  const ms2 = useDerivedValue(() => toMs2(s.rawSensor.value));
  const gx = useDerivedValue(() => formatSigned(ms2.value.x, 3));
  const gy = useDerivedValue(() => formatSigned(ms2.value.y, 3));
  const gz = useDerivedValue(() => formatSigned(ms2.value.z, 3));
  const noiseLabel = t('calibrate.noise');
  const rateLabel = t('calibrate.rate');
  const windowLabel = t('calibrate.window');
  const footer = useDerivedValue(() => {
    const hz = s.rateHz.value > 0 ? Math.round(s.rateHz.value).toString() : '—';
    return `${noiseLabel} ${s.sigma.value.toFixed(3)}° · ${rateLabel} ${hz} Hz · ${windowLabel}`;
  });

  const fmtSample = (v: Sample) =>
    mode === 'flat' ? `X ${formatSigned(v.x, 2)}°  Y ${formatSigned(v.y, 2)}°` : `${formatSigned(v.edge, 2)}°`;
  const result: Sample | null =
    a && b ? { edge: twoPointOffset(a.edge, b.edge), x: twoPointOffset(a.x, b.x), y: twoPointOffset(a.y, b.y), q: a.q } : null;

  const currentOffset =
    mode === 'flat'
      ? `X ${formatSigned(cal.flat.x, 2)}° · Y ${formatSigned(cal.flat.y, 2)}°`
      : `${formatSigned(cal.edge[quarter], 2)}°`;
  const lastDate = cal.date ? new Date(cal.date).toLocaleDateString() : null;

  const modeName = t(mode === 'edge' ? 'mode.edge' : 'mode.flat');
  const title =
    step === 'done' ? t('calibrate.doneTitle') : step === 1 ? t('calibrate.step1Title') : t('calibrate.step2Title');
  const body =
    step === 'done'
      ? t('calibrate.doneBody')
      : step === 1
        ? t(mode === 'flat' ? 'calibrate.step1BodyFlat' : 'calibrate.step1BodyEdge')
        : t(mode === 'flat' ? 'calibrate.step2BodyFlat' : 'calibrate.step2BodyEdge');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()} accessibilityLabel={t('a11y.close')}>
          <X color={colors.text} size={20} strokeWidth={1.8} />
        </IconButton>
        <View>
          <Text style={styles.title} accessibilityRole="header">
            {t('calibrate.title')}
          </Text>
          <Text style={styles.overline}>
            {step === 'done' ? t('calibrate.doneStep') : t('calibrate.step', { n: step })}
          </Text>
        </View>
      </View>

      <View style={styles.progress}>
        <View style={[styles.segment, { backgroundColor: step !== 1 ? colors.ok : colors.chip }]} />
        <View style={[styles.segment, { backgroundColor: step === 'done' ? colors.ok : colors.chip }]} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.illustration}>
          <View style={step === 2 ? styles.flipped : undefined}>
            <Smartphone color={colors.textSecondary} size={96} strokeWidth={1.2} />
          </View>
          <View style={styles.rotateBadge}>
            {step === 'done' ? (
              <Check color={colors.ok} size={28} strokeWidth={1.8} />
            ) : (
              <RotateCw color={step === 2 ? colors.ok : colors.textMuted} size={28} strokeWidth={1.8} />
            )}
          </View>
        </View>
        <Text style={styles.modeLine}>{t('calibrate.calibrating', { mode: modeName })}</Text>
        <Text style={styles.h2}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('calibrate.liveSensor')}</Text>
            <View style={styles.stillRow}>
              <View style={[styles.dot, { backgroundColor: still ? colors.ok : colors.warn }]} />
              <Text style={[styles.stillText, { color: still ? colors.ok : colors.warn }]}>
                {still ? t('calibrate.still') : t('calibrate.moving')}
              </Text>
            </View>
          </View>
          <View style={styles.cells}>
            {[
              ['gx', gx],
              ['gy', gy],
              ['gz', gz],
            ].map(([label, v]) => (
              <View key={label as string} style={styles.cell}>
                <Text style={styles.cellLabel}>{label as string}</Text>
                <AnimatedText text={v as typeof gx} style={styles.cellValue} />
              </View>
            ))}
          </View>
          <AnimatedText text={footer} style={styles.footer} />
        </View>

        <View style={[styles.card, styles.rowsCard]}>
          <View style={styles.row}>
            <View style={[styles.badge, a && styles.badgeDone]}>
              {a ? <Check color={colors.onOk} size={14} strokeWidth={2.2} /> : <Text style={styles.badgeText}>1</Text>}
            </View>
            <Text style={styles.rowLabel}>{t('calibrate.readingA')}</Text>
            <Text style={styles.rowValue}>{a ? fmtSample(a) : t('calibrate.waiting')}</Text>
          </View>
          <View style={[styles.row, styles.divider]}>
            <View style={[styles.badge, b && styles.badgeDone]}>
              {b ? <Check color={colors.onOk} size={14} strokeWidth={2.2} /> : <Text style={styles.badgeText}>2</Text>}
            </View>
            <Text style={styles.rowLabel}>{t('calibrate.readingB')}</Text>
            <Text style={styles.rowValue}>{b ? fmtSample(b) : t('calibrate.waiting')}</Text>
          </View>
          <View style={[styles.row, styles.divider]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Σ</Text>
            </View>
            <Text style={styles.rowLabel}>{t('calibrate.newOffset')}</Text>
            <Text style={[styles.rowValue, result && { color: colors.ok }]}>{result ? fmtSample(result) : '—'}</Text>
          </View>
        </View>

        <Pressable onPress={() => request('zero')} accessibilityRole="button" style={styles.zero} hitSlop={4}>
          <Text style={styles.zeroText}>{t('calibrate.setZero')}</Text>
          <Text style={styles.zeroHint}>{t('calibrate.setZeroHint')}</Text>
        </Pressable>

        <Text style={styles.note}>
          {t('calibrate.currentOffset', { offset: currentOffset })}
          {' · '}
          {lastDate ? t('calibrate.lastCalibrated', { date: lastDate }) : t('calibrate.never')}
        </Text>
        {message ? (
          <Text style={[styles.message, message === t('calibrate.holdStill') && { color: colors.warn }]} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.buttons, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={onReset} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.btnText}>{t('calibrate.reset')}</Text>
        </Pressable>
        {step === 'done' ? (
          <>
            <Pressable onPress={restart} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.btnText}>{t('calibrate.again')}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={[styles.btn, styles.capture]}>
              <Text style={[styles.btnText, styles.captureText]}>{t('calibrate.done')}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={() => request('capture')}
            accessibilityRole="button"
            accessibilityState={{ busy: pending === 'capture' }}
            style={[styles.btn, styles.capture, !still && styles.captureMoving]}>
            <Text style={[styles.btnText, styles.captureText]}>{t('calibrate.capture')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { ...type.title, color: colors.text },
  overline: { ...type.overline, color: colors.textMuted, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 6, marginTop: space.lg },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  scroll: { flex: 1, marginHorizontal: -space.xl },
  scrollContent: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  illustration: { alignSelf: 'center', marginTop: space.xl, width: 120, height: 110, alignItems: 'center', justifyContent: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
  rotateBadge: { position: 'absolute', right: 0, top: 0 },
  modeLine: { ...type.overline, color: colors.textFaint, textAlign: 'center', marginTop: space.md },
  h2: { ...type.h2, color: colors.text, textAlign: 'center', marginTop: space.xs },
  body: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: space.xs },
  card: {
    marginTop: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.md + 2,
    gap: space.md,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...type.cardTitle, color: colors.textSecondary },
  stillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stillText: { ...type.label, fontSize: 12 },
  cells: { flexDirection: 'row', gap: space.sm, direction: 'ltr' },
  cell: { flex: 1, backgroundColor: colors.surfaceInset, borderRadius: radius.cell, padding: space.sm + 2, gap: 3 },
  cellLabel: { ...type.diag, color: colors.textMuted },
  cellValue: { ...type.value, color: colors.text },
  footer: { ...type.diag, color: colors.textFaint },
  rowsCard: { paddingVertical: space.xs, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: { backgroundColor: colors.ok },
  badgeText: { ...type.valueSm, fontSize: 12, color: colors.text },
  rowLabel: { ...type.body, fontSize: 13, color: colors.textMuted, flex: 1 },
  rowValue: { ...type.valueSm, color: colors.text, ...ltr },
  zero: { marginTop: space.lg, minHeight: size.touch, justifyContent: 'center' },
  zeroText: { ...type.button, fontSize: 14, color: colors.info },
  zeroHint: { ...type.label, color: colors.textFaint, marginTop: 2 },
  note: { ...type.diag, color: colors.textFaint, marginTop: space.md },
  message: { ...type.body, fontSize: 13, color: colors.ok, marginTop: space.sm },
  buttons: { flexDirection: 'row', gap: space.sm, paddingTop: space.md },
  btn: { flex: 1, height: size.primaryButton, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  pressed: { backgroundColor: colors.chip },
  capture: { flex: 1.4, backgroundColor: colors.ok },
  captureMoving: { opacity: 0.45 },
  btnText: { ...type.button, fontSize: 14, color: colors.text, textAlign: 'center' },
  captureText: { color: colors.onOk },
});
