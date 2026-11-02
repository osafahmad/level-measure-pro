import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { List, Settings as SettingsIcon } from 'lucide-react-native';
import Animated, { Easing, Keyframe, useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { AdBannerSlot, useSuppressAppOpen } from '../../ads';
import { IconButton } from '../components/IconButton';
import { ModeTabs, type TabMode } from '../components/ModeTabs';
import { SaveReadingSheet } from '../components/SaveReadingSheet';
import { StatusLine } from '../components/StatusLine';
import { Toolbar } from '../components/Toolbar';
import { useStateColor } from '../components/useStateColor';
import { formatPrimary, formatSigned, nextUnits, slopePercent } from '../math/levelMath';
import type { LevelScreenProps } from '../navigation';
import { haptics } from '../platform/haptics';
import { DebugOverlay } from '../sensors/DebugOverlay';
import { useLevel, useMeasuring } from '../sensors/LevelSensorContext';
import { useLevelEvents } from '../sensors/useLevelEvents';
import { useCalibration } from '../state/calibrationStore';
import { useReadings } from '../state/readingsStore';
import { useSettings } from '../state/settingsStore';
import { colors, space, type } from '../theme/tokens';
import { EdgeView } from './EdgeView';
import { FlatView } from './FlatView';
import { HeldPill, HeldView, type HeldReading } from './HeldView';

const EASE = Easing.out(Easing.cubic);
const ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 12 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE },
}).duration(280);
const EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: 12 }], easing: EASE },
}).duration(280);

type SaveDraft = { mode: 'edge' | 'flat'; angle: number; x: number; y: number; sigma: number };

export function LevelScreen({ navigation }: LevelScreenProps<'Level'>) {
  useMeasuring('level');
  const s = useLevel();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const settings = useSettings(
    useShallow(st => ({
      tolerance: st.tolerance,
      units: st.units,
      frameWidthMm: st.frameWidthMm,
      update: st.update,
    })),
  );
  const cal = useCalibration(useShallow(c => ({ flat: c.flat, edge: c.edge, method: c.method })));
  const readings = useReadings(st => st.readings);
  const addReading = useReadings(st => st.add);

  const ev = useLevelEvents(s, { enabled: isFocused, levelAnnouncement: t('a11y.levelReached') });
  const color = useStateColor(s);

  const [auto, setAuto] = useState(true);
  const [held, setHeld] = useState<HeldReading | null>(null);
  const [draft, setDraft] = useState<SaveDraft | null>(null);
  const [debug, setDebug] = useState(false);
  // No App Open ad over a held reading or the save sheet.
  useSuppressAppOpen(held !== null || draft !== null);

  const calibrated = cal.method !== 'none';
  const relative = cal.method === 'zero';
  // Before calibration a phone can be off by a degree or more, so promise no figure.
  const accuracy = calibrated ? '±0.1°' : t('status.notCalibrated');

  const liveValue = useDerivedValue(() => formatPrimary(s.primary.value, s.units.value));

  const onTab = useCallback(
    (m: TabMode) => {
      s.auto.value = false;
      s.mode.value = m;
      setAuto(false);
    },
    [s],
  );
  const onAuto = useCallback(() => {
    s.auto.value = true;
    setAuto(true);
  }, [s]);

  const onHold = useCallback(() => {
    haptics.light();
    const mode = s.mode.value;
    const q = s.q.value;
    setHeld({
      mode,
      angle: s.holdValue.value,
      x: s.holdX.value,
      y: s.holdY.value,
      bearing: s.bearing.value,
      sigma: s.sigma.value,
      samples: Math.max(1, Math.round(s.rateHz.value * 0.5)),
      time: new Date(),
      offset:
        mode === 'edge'
          ? `${formatSigned(cal.edge[q], 2)}°`
          : `X ${formatSigned(cal.flat.x, 2)}° · Y ${formatSigned(cal.flat.y, 2)}°`,
    });
  }, [s, cal]);

  const onSaveLive = useCallback(() => {
    setDraft({
      mode: s.mode.value,
      angle: s.holdValue.value,
      x: s.holdX.value,
      y: s.holdY.value,
      sigma: s.sigma.value,
    });
  }, [s]);

  const onSaveHeld = useCallback(() => {
    if (!held) return;
    setDraft({ mode: held.mode, angle: held.angle, x: held.x, y: held.y, sigma: held.sigma });
  }, [held]);

  const commitSave = useCallback(
    (name: string) => {
      if (!draft) return;
      addReading({
        name,
        mode: draft.mode,
        angle: draft.angle,
        ...(draft.mode === 'flat' ? { x: draft.x, y: draft.y } : null),
        slopePct: slopePercent(draft.angle),
        sigma: draft.sigma,
      });
      haptics.light();
      setDraft(null);
    },
    [draft, addReading],
  );

  const openCalibrate = () => navigation.navigate('Calibrate');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.titleBlock}
          onLongPress={__DEV__ ? () => setDebug(d => !d) : undefined}
          accessibilityRole="header"
          accessibilityHint={__DEV__ ? t('a11y.debug') : undefined}>
          <Text style={styles.title}>{t('level.title')}</Text>
          {held ? (
            <StatusLine rateHz={s.rateHz} live liveLabel={t('status.live')} hzLabel={t('status.hz')} liveValue={liveValue} />
          ) : (
            <StatusLine
              rateHz={s.rateHz}
              accuracy={accuracy}
              live={s.available}
              liveLabel={t('status.live')}
              hzLabel={t('status.hz')}
            />
          )}
        </Pressable>
        {held ? (
          <HeldPill />
        ) : (
          <View style={styles.headerButtons}>
            <IconButton onPress={() => navigation.navigate('Readings')} accessibilityLabel={t('readings.title')}>
              <List color={colors.text} size={18} strokeWidth={1.8} />
            </IconButton>
            <IconButton onPress={() => navigation.navigate('Settings')} accessibilityLabel={t('a11y.settings')}>
              <SettingsIcon color={colors.text} size={18} strokeWidth={1.8} />
            </IconButton>
          </View>
        )}
      </View>
      {!held && !s.available ? (
        <Text style={styles.note}>{t('status.unavailable')}</Text>
      ) : !held && !calibrated ? (
        <Pressable onPress={openCalibrate} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.note}>{t('status.calibrateHint')}</Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {held ? (
          <HeldView
            held={held}
            units={settings.units}
            tolerance={settings.tolerance}
            frameWidthMm={settings.frameWidthMm}
            recent={readings.slice(0, 2)}
            onSave={onSaveHeld}
            onRelease={() => setHeld(null)}
            onSeeAll={() => navigation.navigate('Readings')}
          />
        ) : (
          <>
            <View style={styles.tabs}>
              <ModeTabs value={ev.mode} onChange={onTab} auto={auto} onAuto={onAuto} />
            </View>
            {ev.mode === 'edge' ? (
              <Animated.View key="edge" entering={ENTER} exiting={EXIT}>
                <EdgeView
                  s={s}
                  color={color}
                  state={ev.state}
                  hint={ev.hint}
                  stable={ev.stable}
                  hapticSentAt={ev.hapticSentAt}
                  tolerance={settings.tolerance}
                  frameWidthMm={settings.frameWidthMm}
                  offset={cal.edge[ev.quarter]}
                  relative={relative}
                />
              </Animated.View>
            ) : (
              <Animated.View key="flat" entering={ENTER} exiting={EXIT}>
                <FlatView s={s} color={color} offsetX={cal.flat.x} offsetY={cal.flat.y} relative={relative} />
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {!held ? (
        <View style={styles.toolbar}>
          <Toolbar
            onCalibrate={openCalibrate}
            onHold={onHold}
            onUnits={() => settings.update({ units: nextUnits(settings.units) })}
            onSave={onSaveLive}
            units={settings.units}
          />
        </View>
      ) : (
        <View style={styles.heldSpacer} />
      )}
      {/* Owns the bottom safe area; an ad only adds its own height below the toolbar. */}
      <AdBannerSlot placement="Level" style={styles.banner} />

      <SaveReadingSheet
        visible={draft !== null}
        defaultName={t('readings.defaultName', { n: readings.length + 1 })}
        summary={draft ? `${t(draft.mode === 'edge' ? 'mode.edgeUpper' : 'mode.flatUpper')} · ${formatPrimary(draft.angle, settings.units)}` : ''}
        onCancel={() => setDraft(null)}
        onSave={commitSave}
      />
      {__DEV__ && debug ? <DebugOverlay s={s} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  titleBlock: { flexShrink: 1 },
  title: { ...type.title, color: colors.text },
  headerButtons: { flexDirection: 'row', gap: space.sm },
  note: { ...type.label, color: colors.textFaint, marginTop: space.xs },
  scroll: { flex: 1, marginHorizontal: -space.xl },
  scrollContent: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  tabs: { marginTop: space.lg },
  toolbar: { paddingTop: space.md, paddingBottom: space.md },
  heldSpacer: { height: space.md },
  banner: { marginHorizontal: -space.xl },
});
