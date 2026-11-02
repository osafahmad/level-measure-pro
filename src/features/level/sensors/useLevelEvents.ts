import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { edgeHintBucket, levelState, type LevelState } from '../math/levelMath';
import { haptics } from '../platform/haptics';
import { useSettings } from '../state/settingsStore';
import { STABLE_SIGMA, type LevelSensor, type Mode } from './useLevelSensor';

const ANNOUNCE_THROTTLE_MS = 3000;

/**
 * Bridges discrete UI-thread changes to React (animation.md § 4). Each reaction only crosses to
 * JS when its derived value actually changes, never per frame.
 */
export function useLevelEvents(s: LevelSensor, opts: { enabled: boolean; levelAnnouncement: string }) {
  const [mode, setMode] = useState<Mode>('edge');
  const [quarter, setQuarter] = useState(0);
  const [state, setState] = useState<LevelState>('bad');
  const [stable, setStable] = useState(false);
  const [hint, setHint] = useState(0);
  const [hapticSentAt, setHapticSentAt] = useState(0);
  const lastAnnounce = useRef(0);
  const hapticsOn = useSettings(st => st.haptics);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const hapticsRef = useRef(hapticsOn);
  hapticsRef.current = hapticsOn;

  const onState = useCallback((next: LevelState, entered: boolean) => {
    setState(next);
    if (!entered || !optsRef.current.enabled) return;
    if (hapticsRef.current) {
      haptics.success();
      setHapticSentAt(Date.now());
    }
    const now = Date.now();
    if (now - lastAnnounce.current > ANNOUNCE_THROTTLE_MS) {
      lastAnnounce.current = now;
      AccessibilityInfo.announceForAccessibility(optsRef.current.levelAnnouncement);
    }
  }, []);

  const onTick = useCallback(() => {
    if (optsRef.current.enabled) haptics.tick();
  }, []);

  useAnimatedReaction(
    () => s.mode.value,
    (m, prev) => {
      if (m !== prev) scheduleOnRN(setMode, m);
    },
  );

  useAnimatedReaction(
    () => s.q.value,
    (q, prev) => {
      if (q !== prev) scheduleOnRN(setQuarter, q);
    },
  );

  // Level enter / leave with hysteresis (sensor-math.md § 7).
  useAnimatedReaction(
    () => levelState(Math.abs(s.primary.value), s.tolerance.value, s.wasLevel.value),
    (next, prev) => {
      if (next === prev) return;
      const isLevel = next === 'ok';
      s.wasLevel.value = isLevel;
      scheduleOnRN(onState, next, isLevel && prev !== null && prev !== 'ok');
    },
  );

  useAnimatedReaction(
    () => s.sigma.value < STABLE_SIGMA,
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setStable, v);
    },
  );

  useAnimatedReaction(
    () => (s.mode.value === 'edge' ? edgeHintBucket(s.edge.value, s.wasLevel.value, s.frameMm.value) : 0),
    (b, prev) => {
      if (b !== prev) scheduleOnRN(setHint, b);
    },
  );

  // Optional degree ticks: one light haptic per whole degree while above 1°.
  useAnimatedReaction(
    () => {
      const a = Math.abs(s.primary.value);
      return a > 1 ? Math.round(a) : 0;
    },
    (deg, prev) => {
      if (deg !== prev && deg > 0 && prev !== null && s.ticks.value) scheduleOnRN(onTick);
    },
  );

  return { mode, quarter, state, isLevel: state === 'ok', stable, hint, hapticSentAt };
}
