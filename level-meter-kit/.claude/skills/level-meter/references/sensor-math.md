# Sensor and math — Level

## 1. Sensor source

Use Reanimated's gravity sensor, which runs on the UI thread with no bridge traffic:

```ts
import { useAnimatedSensor, SensorType } from 'react-native-reanimated';

const gravity = useAnimatedSensor(SensorType.GRAVITY, {
  interval: 10,                      // ms → ~100 Hz request; the OS may deliver less
  adjustToInterfaceOrientation: false // we want raw DEVICE axes; the app is locked to portrait
});
// gravity.sensor.value → { x, y, z, interfaceOrientation }
// gravity.isAvailable → false on devices without the sensor: fall back to SensorType.ACCELEROMETER
```

- **Units differ by platform** (m/s² on Android, possibly g on iOS). All tilt math uses the
  *normalized* vector, so units do not matter for angles. For the `g` diagnostic: if the raw
  magnitude is below 2, treat it as g and multiply by 9.80665.
- If `isAvailable` is false, use `SensorType.ACCELEROMETER` with a stronger filter (τ = 150 ms).
- Lock the app to portrait (`app.json` `"orientation": "portrait"` or native config). Edge mode
  rotates its own content instead (see § 4).

## 2. Canonical frame and platform signs

Canonical device frame: **x** → right edge, **y** → top edge, **z** → out of the screen toward
the user. The canonical vector **u** is the unit "up" vector in that frame (the direction the
reaction to gravity points, like Android's accelerometer).

Expected canonical values — **verify each on a physical Android phone and iPhone**:

| Pose | Expected u (x, y, z) |
|---|---|
| Standing upright in portrait | (0, +1, 0) |
| Lying flat, screen up | (0, 0, +1) |
| Portrait, right side raised a little (rotated counter-clockwise as you look at it) | (+small, ≈1, 0) |
| Lying flat, right edge raised a little | (+small, 0, ≈1) |
| Lying flat, top edge raised a little | (0, +small, ≈1) |

If a platform reports the opposite sign on an axis, flip it in `SIGN` (below). Log raw values in a
debug overlay (`__DEV__` only) to fill this in. Do not ship until both platforms match the table.

## 3. Sign conventions (product level)

- **Edge angle positive = right side higher** → hint "Raise left side". Bubble moves right.
- **Flat X positive = right edge higher**, **Flat Y positive = top edge higher**.
- The bubble always moves toward the **higher** side (like a real spirit level).
- **High side bearing**: 0° = top edge of the phone, 90° = right edge, clockwise.

## 4. Formulas

Let `u = (x, y, z)` be the filtered, normalized vector. Angles in degrees.

**Mode detection** (with hysteresis so it does not flicker):
```
zr = |z|
edge → flat when zr > 0.82   (within ~35° of lying flat)
flat → edge when zr < 0.70
```

**Edge mode**
```
θ = atan2(x, y)                         // −180..180, 0 = upright portrait
q = current quarter turn (0, 1, 2, 3)   // which edge is down
keep q unless |wrap(θ − 90·q)| > 55°, then q = round(θ / 90) mod 4
edge = wrap(θ − 90·q)                   // wrap to −180..180, then it is within ±55
contentRotation = −90·q                 // rotate the edge UI so text stays upright
```

**Flat mode**
```
X = atan2(x, √(y² + z²))
Y = atan2(y, √(x² + z²))
total = √(X² + Y²)
bearing (high side) = (atan2(X, Y) + 360) mod 360
compass = ['N','NE','E','SE','S','SW','W','NW'][round(bearing / 45) mod 8]
```
Here "N" means "toward the top edge of the phone", not geographic north. Label it "High side".

**Units** (a = |angle|, t = tan a)
```
slope %          = t × 100
rise mm per m    = t × 1000
ratio 1:X        = 1 / t           // show "—" when a < 0.05°
over length L mm = t × L
roof pitch x/12  = t × 12          // optional unit
```

**Edge hint correction**: `mm = tan(|edge|) × frameWidthMm` (default 600 mm, user setting).

## 5. Filtering

Filter the **vector**, not the angles (avoids wrap-around glitches), and make it frame-rate
independent:
```
α = 1 − exp(−dt / τ)      // dt from frameInfo.timeSincePreviousFrame (ms), τ = 80 ms default
f = f + α · (raw − f)     // per component, then renormalize f
```
Settings → Smoothing: Fast (τ 40), Normal (τ 80), Steady (τ 160).

**Velocity** (for bubble stretch): `v = (angle − prevAngle) / (dt / 1000)` deg/s, itself smoothed
with τ = 60 ms.

**Stability σ** (exponentially weighted std-dev of the primary angle, τs = 500 ms):
```
β = 1 − exp(−dt / τs)
d = angle − mean
mean += β · d
var = (1 − β) · (var + β · d²)
σ = √var
stable = σ < 0.05° (shown as "Stable"), otherwise "Settling…"
```

**Hold value**: keep a slow filter of the primary angle (τ = 400 ms). Hold freezes that value
(≈ average of the last 0.5 s). Show "Averaged over 0.5 s · σ x.xx°".

## 6. Calibration

Phone cases and sensors carry a small bias. Offsets are stored in degrees and **subtracted** from
the computed angles.

**Two-point (recommended, removes bias without a known-flat surface)**
- Flat: capture A on any surface, rotate the phone 180° about the vertical axis on the same
  spot, capture B. True tilt flips sign, bias does not:
  `offset = (A + B) / 2` per axis; `true tilt at A = (A − B) / 2`.
- Edge: same idea, per edge (q = 0..3). Capture A, flip the phone end-for-end on the same edge,
  capture B. `edgeOffset[q] = (A + B) / 2`.

**Quick zero** ("Set zero here"): `offset = current reading`. Mark the readout with a `REL` tag
because it is relative to that surface, not true level.

**Capture rule**: only capture while `stable` for 1 s; captured value = slow filter (τ 400 ms).
If not stable, show "Hold the phone still" and wait.

Persist with MMKV: `{ flat: {x, y}, edge: [o0, o1, o2, o3], mode: 'two-point' | 'zero', date }`.
"Reset to factory" clears all offsets.

## 7. Level detection and haptics

```
enter level when abs < tolerance
leave level when abs > tolerance + 0.2°     // hysteresis, prevents buzzing at the edge
```
On enter: success haptic + `AccessibilityInfo.announceForAccessibility('Level')` (throttled
to once per 3 s). Optional setting "Degree ticks": a light selection haptic each time the
rounded angle changes by 1° while above 1°.

## 8. Phase 2 math

**Table mode** (table length L along phone Y, width W along phone X, phone in the center):
```
corner height (mm) relative to center plane:
h(sx, sy) = sx · (W/2) · tan X + sy · (L/2) · tan Y     sx, sy ∈ {−1, +1}
reference = max over the four corners
raise each leg by (reference − h)   → the highest leg gets 0 mm
```
Presets (editable, playing-surface size): Snooker 12 ft 3569 × 1778 mm; Pool 9 ft 2540 × 1270 mm;
Pool 8 ft 2240 × 1120 mm; Foosball 1200 × 700 mm (typical, ask the user to measure); Custom.

**Slope mode**: primary unit %. Target slope T (e.g. 1.5 %) with tolerance ±0.25 %.
Water flows toward the **low** side: `flowBearing = (bearing + 180) mod 360`.
"Over distance D": `drop mm = t × D mm`.

## 9. Reference implementation — `src/features/level/math/levelMath.ts`

```ts
export const SIGN = { x: 1, y: 1, z: 1 }; // set per platform after the pose test (see § 2)
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export type Vec3 = { x: number; y: number; z: number };

export function normalize(v: Vec3): Vec3 {
  'worklet';
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: (v.x * SIGN.x) / m, y: (v.y * SIGN.y) / m, z: (v.z * SIGN.z) / m };
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
```

## 10. Required unit tests (`math/__tests__/levelMath.test.ts`)

- `normalize` returns unit length; zero vector does not throw.
- `edgeAngle`: upright → 0; +5° and −5°; 89° with q=0 stays q=0 only until 55°, then switches to q=1;
  landscape both directions; wrap at ±180.
- `flatAngles`: flat → 0/0/0; right edge up → X>0, bearing ≈ 90; top up → Y>0, bearing ≈ 0.
- Units: 0° → 0 %; 45° → 100 %; 1.1° → ≈1.92 %, ≈19.2 mm/m, ratio ≈52.1; `ratio(0)` → null.
- `levelState` hysteresis: 0.6° is `ok` when `wasLevel` and tolerance 0.5, `warn` otherwise.
- `twoPointOffset(0.34, 0.26)` → 0.30.
- `tableLegCorrections`: flat table → all 0; highest corner always 0; values non-negative.
- `alphaFor`: dt 0 → 0; dt = τ → ≈0.632.
