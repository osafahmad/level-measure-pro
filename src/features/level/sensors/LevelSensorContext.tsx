import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { keepAwake } from '../platform/keepAwake';
import { useCalibration } from '../state/calibrationStore';
import { SMOOTHING_TAU, useSettings } from '../state/settingsStore';
import { ACCEL_MIN_TAU, useLevelSensor, type LevelSensor } from './useLevelSensor';

type SetMeasuring = (key: string, on: boolean) => void;

// Two contexts: the shared values (captured by worklets) and the JS-only measuring switch.
const LevelSensorContext = createContext<LevelSensor | null>(null);
const MeasuringContext = createContext<SetMeasuring | null>(null);

/**
 * One sensor pipeline for the whole stack, so Calibrate reuses the Level screen's shared values.
 * The frame callback (and keep-awake) only run while a measuring screen is focused.
 */
export function LevelSensorProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettings(
    useShallow(s => ({
      smoothing: s.smoothing,
      tolerance: s.tolerance,
      frameWidthMm: s.frameWidthMm,
      units: s.units,
      haptics: s.haptics,
      degreeTicks: s.degreeTicks,
      keepAwake: s.keepAwake,
    })),
  );
  const offsets = useCalibration(useShallow(s => ({ flat: s.flat, edge: s.edge })));

  const { frame, values: sensor } = useLevelSensor({
    tau: SMOOTHING_TAU[settings.smoothing],
    offsets,
    tolerance: settings.tolerance,
    frameMm: settings.frameWidthMm,
    units: settings.units,
  });
  const { usingAccel, tau, off, tolerance, frameMm, units, ticks } = sensor;

  useEffect(() => {
    const t = SMOOTHING_TAU[settings.smoothing];
    tau.value = usingAccel ? Math.max(t, ACCEL_MIN_TAU) : t;
  }, [settings.smoothing, usingAccel, tau]);
  useEffect(() => {
    off.value = { flat: offsets.flat, edge: offsets.edge };
  }, [offsets.flat, offsets.edge, off]);
  useEffect(() => {
    tolerance.value = settings.tolerance;
  }, [settings.tolerance, tolerance]);
  useEffect(() => {
    frameMm.value = settings.frameWidthMm;
  }, [settings.frameWidthMm, frameMm]);
  useEffect(() => {
    units.value = settings.units;
  }, [settings.units, units]);
  useEffect(() => {
    ticks.value = settings.haptics && settings.degreeTicks;
  }, [settings.haptics, settings.degreeTicks, ticks]);

  const measuringKeys = useRef(new Set<string>());
  const [measuring, setMeasuringCount] = useState(0);
  const setMeasuring = useCallback((key: string, on: boolean) => {
    if (on) measuringKeys.current.add(key);
    else measuringKeys.current.delete(key);
    setMeasuringCount(measuringKeys.current.size);
  }, []);

  useEffect(() => {
    frame.setActive(measuring > 0);
  }, [measuring, frame]);

  useEffect(() => {
    if (measuring > 0 && settings.keepAwake) {
      keepAwake.on();
      return () => keepAwake.off();
    }
    return undefined;
  }, [measuring, settings.keepAwake]);

  return (
    <MeasuringContext.Provider value={setMeasuring}>
      <LevelSensorContext.Provider value={sensor}>{children}</LevelSensorContext.Provider>
    </MeasuringContext.Provider>
  );
}

export function useLevel(): LevelSensor {
  const ctx = useContext(LevelSensorContext);
  if (!ctx) throw new Error('useLevel must be used inside LevelSensorProvider');
  return ctx;
}

/** Keep the sensor running (and the screen awake) while the calling screen is focused. */
export function useMeasuring(key: string) {
  const setMeasuring = useContext(MeasuringContext);
  if (!setMeasuring) throw new Error('useMeasuring must be used inside LevelSensorProvider');
  useFocusEffect(
    useCallback(() => {
      setMeasuring(key, true);
      return () => setMeasuring(key, false);
    }, [key, setMeasuring]),
  );
}
