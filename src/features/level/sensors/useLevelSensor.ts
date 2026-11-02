import { useEffect, useState } from 'react';
import {
  SensorType,
  useAnimatedSensor,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import {
  alphaFor,
  bearingOf,
  edgeAngle,
  flatAngles,
  magnitudeMs2,
  nextMode,
  normalize,
  unit,
  type Units,
  type Vec3,
} from '../math/levelMath';

export type Mode = 'edge' | 'flat';
export type Offsets = { flat: { x: number; y: number }; edge: [number, number, number, number] };

const SENSOR_CONFIG = { interval: 10, adjustToInterfaceOrientation: false } as const;
export const ACCEL_MIN_TAU = 150;
export const STABLE_SIGMA = 0.05;
const RATE_LISTENER_ID = 0x4c4d50; // listener on the active sensor's shared value (event counter)

/**
 * Gravity sensor → filtered vector → angles, all on the UI thread (animation.md § 2).
 * Nothing in here touches React state; screens read the shared values directly and
 * useLevelEvents forwards discrete changes to JS.
 */
export function useLevelSensor(init: { tau: number; offsets: Offsets; tolerance: number; frameMm: number; units: Units }) {
  const gravity = useAnimatedSensor(SensorType.GRAVITY, SENSOR_CONFIG);
  const accel = useAnimatedSensor(SensorType.ACCELEROMETER, SENSOR_CONFIG);
  // useAnimatedSensor registers (and sets isAvailable) inside its own effect without
  // re-rendering; render once more after mount so the frame callback captures the live sensors.
  const [, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const usingAccel = !gravity.isAvailable && accel.isAvailable;
  const available = gravity.isAvailable || accel.isAvailable;

  const useAccelSource = useSharedValue(usingAccel);
  useEffect(() => {
    useAccelSource.value = usingAccel;
    if (!usingAccel) accel.unregister();
  }, [usingAccel, accel, useAccelSource]);

  // Filter state and outputs.
  const f = useSharedValue<Vec3>({ x: 0, y: 1, z: 0 });
  const rawU = useSharedValue<Vec3>({ x: 0, y: 1, z: 0 }); // normalized canonical (debug)
  const rawSensor = useSharedValue<Vec3>({ x: 0, y: 0, z: 0 }); // as delivered (debug / calibration)
  const g = useSharedValue(0);
  const mode = useSharedValue<Mode>('edge');
  const auto = useSharedValue(true);
  const q = useSharedValue(0);
  const edge = useSharedValue(0);
  const edgeRaw = useSharedValue(0);
  const flatX = useSharedValue(0);
  const flatY = useSharedValue(0);
  const flatXRaw = useSharedValue(0);
  const flatYRaw = useSharedValue(0);
  const total = useSharedValue(0);
  const bearing = useSharedValue(0);
  const primary = useSharedValue(0); // edge angle (signed) or flat total
  const levelAbs = useSharedValue(0); // |primary| smoothed for color transitions
  const velocity = useSharedValue(0);
  const mean = useSharedValue(0);
  const variance = useSharedValue(0);
  const sigma = useSharedValue(0);
  const stableMs = useSharedValue(0);
  const holdValue = useSharedValue(0);
  const holdX = useSharedValue(0);
  const holdY = useSharedValue(0);
  const slowEdgeRaw = useSharedValue(0);
  const slowFlatXRaw = useSharedValue(0);
  const slowFlatYRaw = useSharedValue(0);
  const rateHz = useSharedValue(0);
  const rateEvents = useSharedValue(0);
  const rateWindow = useSharedValue(0);
  const wasLevel = useSharedValue(false);

  // Count every event the active sensor delivers: Reanimated sets the sensor's shared value once
  // per event and calls its listeners synchronously on the UI thread.
  useEffect(() => {
    const source = usingAccel ? accel.sensor : gravity.sensor;
    scheduleOnUI(() => {
      'worklet';
      source.addListener(RATE_LISTENER_ID, () => {
        rateEvents.value += 1;
      });
    });
    return () => {
      scheduleOnUI(() => {
        'worklet';
        source.removeListener(RATE_LISTENER_ID);
      });
    };
  }, [usingAccel, accel, gravity, rateEvents]);

  // Settings mirrored to the UI thread (written by LevelSensorProvider).
  const tau = useSharedValue(init.tau);
  const off = useSharedValue<Offsets>(init.offsets);
  const tolerance = useSharedValue(init.tolerance);
  const frameMm = useSharedValue(init.frameMm);
  const units = useSharedValue<Units>(init.units);
  const ticks = useSharedValue(false);

  const frame = useFrameCallback(info => {
    'worklet';
    const dt = info.timeSincePreviousFrame ?? 16;
    const s = useAccelSource.value ? accel.sensor.value : gravity.sensor.value;
    if (s.x * s.x + s.y * s.y + s.z * s.z < 1e-6) return; // no sample yet (or simulator)

    // Delivered sample rate: sensor events received (counted by the listener below), per second.
    // Some sensors repeat the same value between updates, so values are not compared here.
    // The listener keeps counting while this callback is paused (no measuring screen focused);
    // start a fresh window on the first frame after a pause so those events are not counted.
    if (info.timeSincePreviousFrame == null || dt > 1000) {
      rateEvents.value = 0;
      rateWindow.value = 0;
    }
    rateWindow.value += dt;
    if (rateWindow.value >= 1000) {
      rateHz.value = (rateEvents.value * 1000) / rateWindow.value;
      rateEvents.value = 0;
      rateWindow.value = 0;
    }
    rawSensor.value = { x: s.x, y: s.y, z: s.z };
    g.value = magnitudeMs2(s);

    const raw = normalize(s);
    rawU.value = raw;
    const a = alphaFor(dt, tau.value);
    const p = f.value;
    const u = unit({ x: p.x + a * (raw.x - p.x), y: p.y + a * (raw.y - p.y), z: p.z + a * (raw.z - p.z) });
    f.value = u;

    if (auto.value) mode.value = nextMode(mode.value, Math.abs(u.z));
    const o = off.value;

    const r = edgeAngle(u, q.value);
    const quarterChanged = r.q !== q.value;
    q.value = r.q;
    const prevEdge = edge.value;
    edgeRaw.value = r.angle;
    edge.value = r.angle - o.edge[r.q];

    const fa = flatAngles(u);
    flatXRaw.value = fa.x;
    flatYRaw.value = fa.y;
    flatX.value = fa.x - o.flat.x;
    flatY.value = fa.y - o.flat.y;
    total.value = Math.sqrt(flatX.value * flatX.value + flatY.value * flatY.value);
    bearing.value = bearingOf(flatX.value, flatY.value);

    const prim = mode.value === 'edge' ? edge.value : total.value;
    primary.value = prim;
    levelAbs.value += alphaFor(dt, 60) * (Math.abs(prim) - levelAbs.value);

    // Velocity in deg/s for the bubble stretch; ignore the jump when the down edge changes.
    const instV = quarterChanged ? 0 : (edge.value - prevEdge) / (Math.max(dt, 1) / 1000);
    velocity.value += alphaFor(dt, 60) * (instV - velocity.value);

    // Stability σ (EW std-dev of the primary angle).
    const b = alphaFor(dt, 500);
    const d = prim - mean.value;
    mean.value += b * d;
    variance.value = (1 - b) * (variance.value + b * d * d);
    sigma.value = Math.sqrt(variance.value);
    stableMs.value = sigma.value < STABLE_SIGMA ? stableMs.value + dt : 0;

    // Slow filters (τ 400 ms) for Hold and calibration capture.
    const h = alphaFor(dt, 400);
    holdValue.value += h * (prim - holdValue.value);
    holdX.value += h * (flatX.value - holdX.value);
    holdY.value += h * (flatY.value - holdY.value);
    slowEdgeRaw.value = quarterChanged ? edgeRaw.value : slowEdgeRaw.value + h * (edgeRaw.value - slowEdgeRaw.value);
    slowFlatXRaw.value += h * (flatXRaw.value - slowFlatXRaw.value);
    slowFlatYRaw.value += h * (flatYRaw.value - slowFlatYRaw.value);
  }, false);

  // `frame` stays out of the values object: worklets capture that object, and a captured
  // FrameCallback handle can no longer be mutated by setActive.
  const values = {
    available,
    usingAccel,
    f, rawU, rawSensor, g,
    mode, auto, q,
    edge, edgeRaw, flatX, flatY, flatXRaw, flatYRaw, total, bearing,
    primary, levelAbs, velocity, sigma, stableMs,
    holdValue, holdX, holdY, slowEdgeRaw, slowFlatXRaw, slowFlatYRaw,
    rateHz, wasLevel,
    tau, off, tolerance, frameMm, units, ticks,
  };
  return { frame, values };
}

export type LevelSensor = ReturnType<typeof useLevelSensor>['values'];
