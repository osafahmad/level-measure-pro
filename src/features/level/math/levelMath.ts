import { Platform } from 'react-native';

// Sign per device axis so the normalized vector is the canonical "up" vector (sensor-math.md § 2).
// Reanimated delivers gravity pointing DOWN on both platforms, so all axes are flipped:
// - iOS: Reanimated forwards CoreMotion gravity, which points down.
// - Android: TYPE_GRAVITY / TYPE_ACCELEROMETER report the UP vector, but Reanimated 4.x negates
//   them to match iOS (ReanimatedSensorListener.kt). These Android signs depend on that current
//   Reanimated behavior: repeat the pose test on a physical Android phone after upgrading Reanimated.
// Android verified with the pose test on a Redmi 13 (Reanimated 4.7.1). Flip a single axis here
// only if a pose does not match.
const SIGNS = {
  ios: { x: -1, y: -1, z: -1 },
  android: { x: -1, y: -1, z: -1 },
} as const;
export const SIGN = Platform.OS === 'ios' ? SIGNS.ios : SIGNS.android;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const G = 9.80665;

export type Vec3 = { x: number; y: number; z: number };
export type Units = 'deg' | 'percent' | 'mmPerM' | 'ratio';

export function normalize(v: Vec3): Vec3 {
  'worklet';
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: (v.x * SIGN.x) / m, y: (v.y * SIGN.y) / m, z: (v.z * SIGN.z) / m };
}

/** Renormalize an already-canonical vector (no SIGN applied). */
export function unit(v: Vec3): Vec3 {
  'worklet';
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export function alphaFor(dtMs: number, tauMs: number): number {
  'worklet';
  return 1 - Math.exp(-Math.max(dtMs, 0) / tauMs);
}

export function wrap180(a: number): number {
  'worklet';
  let r = ((a + 180) % 360 + 360) % 360 - 180;
  return r === -180 ? 180 : r;
}

export function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
}

export function nextMode(current: 'edge' | 'flat', zAbs: number): 'edge' | 'flat' {
  'worklet';
  if (current === 'edge' && zAbs > 0.82) return 'flat';
  if (current === 'flat' && zAbs < 0.7) return 'edge';
  return current;
}

export function edgeAngle(u: Vec3, q: number): { angle: number; q: number } {
  'worklet';
  const theta = Math.atan2(u.x, u.y) * DEG;
  let quarter = q;
  if (Math.abs(wrap180(theta - 90 * quarter)) > 55) {
    quarter = ((Math.round(theta / 90) % 4) + 4) % 4;
  }
  return { angle: wrap180(theta - 90 * quarter), q: quarter };
}

export function flatAngles(u: Vec3): { x: number; y: number; total: number; bearing: number } {
  'worklet';
  const x = Math.atan2(u.x, Math.sqrt(u.y * u.y + u.z * u.z)) * DEG;
  const y = Math.atan2(u.y, Math.sqrt(u.x * u.x + u.z * u.z)) * DEG;
  const total = Math.sqrt(x * x + y * y);
  const bearing = (Math.atan2(x, y) * DEG + 360) % 360;
  return { x, y, total, bearing };
}

/** Edge-mode pitch: how far the screen leans out of vertical (+ = screen faces up). */
export function edgePitch(u: Vec3): number {
  'worklet';
  return Math.atan2(u.z, Math.sqrt(u.x * u.x + u.y * u.y)) * DEG;
}

/** High-side bearing from (calibrated) flat X/Y: 0° = top edge, 90° = right edge, clockwise. */
export function bearingOf(x: number, y: number): number {
  'worklet';
  return (Math.atan2(x, y) * DEG + 360) % 360;
}

export function slopePercent(deg: number): number { 'worklet'; return Math.tan(Math.abs(deg) * RAD) * 100; }
export function risePerMeter(deg: number): number { 'worklet'; return Math.tan(Math.abs(deg) * RAD) * 1000; }
export function overLength(deg: number, mm: number): number { 'worklet'; return Math.tan(Math.abs(deg) * RAD) * mm; }
export function ratio(deg: number): number | null {
  'worklet';
  const a = Math.abs(deg);
  return a < 0.05 ? null : 1 / Math.tan(a * RAD);
}

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export function compass(bearing: number): (typeof COMPASS)[number] {
  'worklet';
  return COMPASS[Math.round(bearing / 45) % 8];
}

export type LevelState = 'ok' | 'warn' | 'bad';
export function levelState(abs: number, tolerance: number, wasLevel: boolean): LevelState {
  'worklet';
  const okLimit = wasLevel ? tolerance + 0.2 : tolerance;
  if (abs < okLimit) return 'ok';
  return abs < 3 ? 'warn' : 'bad';
}

export function twoPointOffset(a: number, b: number): number { 'worklet'; return (a + b) / 2; }

export function tableLegCorrections(xDeg: number, yDeg: number, lengthMm: number, widthMm: number) {
  'worklet';
  const tx = Math.tan(xDeg * RAD), ty = Math.tan(yDeg * RAD);
  const h = (sx: number, sy: number) => sx * (widthMm / 2) * tx + sy * (lengthMm / 2) * ty;
  const corners = { frontLeft: h(-1, -1), frontRight: h(1, -1), backLeft: h(-1, 1), backRight: h(1, 1) };
  const ref = Math.max(corners.frontLeft, corners.frontRight, corners.backLeft, corners.backRight);
  return {
    frontLeft: ref - corners.frontLeft, frontRight: ref - corners.frontRight,
    backLeft: ref - corners.backLeft, backRight: ref - corners.backRight,
  };
}

// ---- Display helpers (UI never computes angles or units itself) ----

/** Sensor magnitude in m/s²; iOS may report in g (|v| < 2). */
export function magnitudeMs2(v: Vec3): number {
  'worklet';
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return m < 2 ? m * G : m;
}

/** Raw sensor vector in m/s² (for the calibration LIVE SENSOR card). */
export function toMs2(v: Vec3): Vec3 {
  'worklet';
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  const k = m < 2 ? G : 1;
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

export function formatSigned(v: number, decimals: number): string {
  'worklet';
  const s = Math.abs(v).toFixed(decimals);
  return (v < 0 && Number(s) !== 0 ? '−' : '+') + s;
}

export function formatRatio(deg: number): string {
  'worklet';
  const r = ratio(deg);
  if (r === null) return '—';
  return '1:' + (r >= 100 ? Math.round(r).toString() : r.toFixed(1));
}

/** Primary readout text for the selected unit (absolute value, sign is shown by hints). */
export function formatPrimary(deg: number, units: Units, decimals = 1): string {
  'worklet';
  const a = Math.abs(deg);
  if (units === 'percent') return slopePercent(a).toFixed(decimals + 1) + '%';
  if (units === 'mmPerM') return risePerMeter(a).toFixed(decimals);
  if (units === 'ratio') return formatRatio(a);
  return a.toFixed(decimals) + '°';
}

export const UNITS_CYCLE: Units[] = ['deg', 'percent', 'mmPerM', 'ratio'];
export function nextUnits(u: Units): Units {
  const i = UNITS_CYCLE.indexOf(u);
  return UNITS_CYCLE[(i + 1) % UNITS_CYCLE.length];
}

/** Millimetres to raise the low side of a frame of width frameMm, rounded for display. */
export function roundHintMm(mm: number): number {
  'worklet';
  const a = Math.abs(mm);
  if (a >= 10) return Math.round(a);
  return Math.max(Math.round(a * 10) / 10, 0.1);
}

/**
 * Bucketed edge hint pushed to React only when it changes:
 * 0 = level; > 0 = raise LEFT side by that many mm (right side is higher); < 0 = raise RIGHT side.
 */
export function edgeHintBucket(angle: number, isLevel: boolean, frameMm: number): number {
  'worklet';
  if (isLevel) return 0;
  const mm = roundHintMm(overLength(angle, frameMm));
  return angle >= 0 ? mm : -mm;
}

/** Edge bubble travel in px: ±118 px for ±10°, clamped. */
export function vialOffset(angle: number): number {
  'worklet';
  return clamp(angle / 10, -1, 1) * 118;
}

/** Flat bubble position in px (23 px per degree), clamped to a circle of radius 115. */
export function targetOffset(x: number, y: number): { dx: number; dy: number } {
  'worklet';
  let dx = x * 23;
  let dy = -y * 23;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r > 115) {
    dx = (dx / r) * 115;
    dy = (dy / r) * 115;
  }
  return { dx, dy };
}

/** Axis bar marker position in [-1, 1]; the track spans ±5°. */
export function axisFraction(deg: number): number {
  'worklet';
  return clamp(deg / 5, -1, 1);
}
