# Animation — Level

Goal: the level should feel like a physical instrument. The bubble has weight and settles, the
needle sweeps, colors fade between states, and everything holds 60 fps (120 on ProMotion /
high-refresh Android) while the JS thread stays idle.

Library: `react-native-reanimated` (3.x or 4.x). On Reanimated 4 install `react-native-worklets`
and use `scheduleOnRN` where this file says `runOnJS`.

## 1. Data flow

```
useAnimatedSensor(GRAVITY)          UI thread
        │
useFrameCallback  ──► filtered vector f, mode, q, edge, flatX, flatY,
                      velocity, sigma, holdValue      (shared values)
        │
useDerivedValue   ──► primary (edge or total), state ('ok'|'warn'|'bad'), units
        │
useAnimatedStyle / useAnimatedProps  ──► needle, bubble, colors, readout text
        │
useAnimatedReaction ──► runOnJS(...) ONLY on discrete changes:
                        mode switch, level enter, stable flag, quarter turn
```

## 2. The sensor hook — `sensors/useLevelSensor.ts`

```ts
import { useAnimatedSensor, SensorType, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { normalize, alphaFor, nextMode, edgeAngle, flatAngles } from '../math/levelMath';

export function useLevelSensor(opts: { tau: number; offsets: Offsets }) {
  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 10, adjustToInterfaceOrientation: false });

  const f = useSharedValue({ x: 0, y: 1, z: 0 });
  const mode = useSharedValue<'edge' | 'flat'>('edge');
  const q = useSharedValue(0);
  const edge = useSharedValue(0);
  const flatX = useSharedValue(0);
  const flatY = useSharedValue(0);
  const total = useSharedValue(0);
  const bearing = useSharedValue(0);
  const velocity = useSharedValue(0);
  const mean = useSharedValue(0);
  const variance = useSharedValue(0);
  const holdValue = useSharedValue(0);
  const held = useSharedValue(false);
  const tau = useSharedValue(opts.tau);
  const off = useSharedValue(opts.offsets); // { flat: {x,y}, edge: [4] } — update when calibration changes

  useFrameCallback((info) => {
    'worklet';
    if (held.value) return;
    const dt = info.timeSincePreviousFrame ?? 16;
    const raw = normalize(sensor.sensor.value);
    const a = alphaFor(dt, tau.value);
    const p = f.value;
    f.value = normalize({ x: p.x + a * (raw.x - p.x), y: p.y + a * (raw.y - p.y), z: p.z + a * (raw.z - p.z) });

    mode.value = nextMode(mode.value, Math.abs(f.value.z));
    let primary: number;
    if (mode.value === 'edge') {
      const r = edgeAngle(f.value, q.value);
      q.value = r.q;
      const prev = edge.value;
      edge.value = r.angle - off.value.edge[r.q];
      velocity.value += alphaFor(dt, 60) * ((edge.value - prev) / (dt / 1000) - velocity.value);
      primary = edge.value;
    } else {
      const r = flatAngles(f.value);
      flatX.value = r.x - off.value.flat.x;
      flatY.value = r.y - off.value.flat.y;
      total.value = Math.sqrt(flatX.value ** 2 + flatY.value ** 2);
      bearing.value = r.bearing;
      primary = total.value;
    }
    const b = alphaFor(dt, 500);
    const d = primary - mean.value;
    mean.value += b * d;
    variance.value = (1 - b) * (variance.value + b * d * d);
    holdValue.value += alphaFor(dt, 400) * (primary - holdValue.value);
  });

  return { mode, q, edge, flatX, flatY, total, bearing, velocity, mean, variance, holdValue, held, tau, off, available: sensor.isAvailable };
}
```

Notes:
- `useFrameCallback` starts automatically; pause it (`setActive(false)`) when the screen blurs
  (`useIsFocused`) to save battery.
- After applying offsets, compute `total` and `bearing` from the corrected X/Y in a later
  refactor if needed; the version above keeps bearing from raw for simplicity.

## 3. Motion specs

| Element | Animation | Values |
|---|---|---|
| Edge bubble position | `withSpring` toward `clamp(edge / 10) × 118` px | damping 14, stiffness 180, mass 0.6 |
| Edge bubble stretch | `scaleX = 1 + min(|velocity| × 0.004, 0.25)`, `scaleY = 1 / √scaleX` | follows velocity, no spring |
| Flat bubble | `withSpring` on x = X × 23, y = −Y × 23, clamped to radius 115 | same spring |
| Dial needle | `rotate: withSpring(clamp(edge, −15, 15) × 6)` deg around dial center | damping 18, stiffness 220 |
| State color | `interpolateColor(abs, [0, tol, tol + 0.01, 3, 3.01], [ok, ok, warn, warn, bad])`, smoothed by animating `abs` through `withTiming(…, 120 ms)` | used by needle, readout, bubble, chip |
| Readout digits | `AnimatedTextInput` with `animatedProps.text` = value.toFixed(1) | every frame, no React render |
| Vial / target border | `withTiming` to ok color when level | 150 ms |
| Mode switch (Edge ↔ Flat) | outgoing view opacity 1→0 + translateY 0→12; incoming reverse | `withTiming` 280 ms, `Easing.out(Easing.cubic)` |
| Edge content rotation | `rotate: withSpring(−90 × q)` deg | damping 20, stiffness 160 |
| Hint chip text change | crossfade old/new text | 150 ms |
| Hold engage | readout color → info, held pill scales 0.9→1 | `withSpring`, damping 15 |
| Level reached | border + color change only. No glow, no confetti | — |

Reduce Motion (`useReducedMotion()` from Reanimated): replace springs with `withTiming(…, 120)`,
disable bubble stretch and content-rotation animation (snap instead).

## 4. Key snippets

**Needle as a rotated view (do not re-render SVG per frame)**
```tsx
// A 3 px wide, 158 px tall arm whose bottom sits on the dial center (175, 190).
// Requires RN ≥ 0.74 for transformOrigin.
const needleStyle = useAnimatedStyle(() => ({
  transform: [{ rotate: `${withSpring(clamp(edge.value, -15, 15) * 6, NEEDLE_SPRING)}deg` }],
}));
const tipColor = useAnimatedStyle(() => ({ backgroundColor: stateColor.value }));

<Animated.View
  pointerEvents="none"
  style={[{ position: 'absolute', left: 173.5, top: 32, width: 3, height: 158, transformOrigin: 'bottom' }, needleStyle]}>
  {/* visible part: r 104 → 158 from center = top 54 px of the arm */}
  <Animated.View style={[{ width: 3, height: 54, borderRadius: 1.5 }, tipColor]} />
  <Animated.View style={[{ position: 'absolute', top: -5, left: -3.5, width: 10, height: 10, borderRadius: 5 }, tipColor]} />
</Animated.View>
```
Draw the static dial (arcs, ticks, labels) once in `react-native-svg`, wrapped in `React.memo`.

**UI-thread text**
```tsx
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
Animated.addWhitelistedNativeProps({ text: true }); // needed on Reanimated 3
export function AnimatedReadout({ value, decimals = 1, suffix = '°', style }) {
  const props = useAnimatedProps(() => ({ text: `${Math.abs(value.value).toFixed(decimals)}${suffix}` } as any));
  return <AnimatedTextInput editable={false} underlineColorAndroid="transparent" defaultValue={`0.0${suffix}`} animatedProps={props} style={style} />;
}
```

**Discrete events to JS**
```ts
useAnimatedReaction(
  () => levelState(primary.value, tol.value, wasLevel.value) === 'ok',
  (isLevel, prev) => {
    if (isLevel !== prev) {
      wasLevel.value = isLevel;
      if (isLevel) runOnJS(onLevelReached)(); // haptic + a11y announce
    }
  },
);
```

**Hint text** changes rarely; derive a bucketed value on the UI thread (state + rounded mm) and
push it to React with `runOnJS` only when the bucket changes.

## 5. Performance rules

- No `console.log` in worklets in release builds.
- No object allocation per frame in hot paths beyond the small vectors shown; never create
  arrays per frame.
- Static layers (dial ticks, target rings, vial marks) are memoized components.
- Keep shadows off; use borders. Avoid `overflow: hidden` + border radius on animated views
  where possible (Android cost).
- Test on a low-end Android device (e.g. 2 GB RAM). Target: JS thread idle, UI thread < 8 ms per frame.
