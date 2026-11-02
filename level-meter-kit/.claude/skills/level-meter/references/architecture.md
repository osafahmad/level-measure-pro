# Architecture — Level

Works for both **Expo (prebuild / dev client)** and **bare React Native**. Expo Go cannot run
custom native modules such as MMKV, so use a development build. Pick one column below and use it
consistently.

## 1. Dependencies

| Need | Expo | Bare RN |
|---|---|---|
| Animation + sensor | `react-native-reanimated` (+ `react-native-worklets` on v4) | same |
| Gestures (sheets, long-press) | `react-native-gesture-handler` | same |
| Vector graphics | `react-native-svg` | same |
| Icons | `lucide-react-native` | same |
| Haptics | `expo-haptics` | `react-native-haptic-feedback` |
| Keep screen awake | `expo-keep-awake` | `react-native-keep-awake` (or `@sayem314/react-native-keep-awake`) |
| Storage | `react-native-mmkv` | same |
| Navigation | `@react-navigation/native` + `native-stack` | same |
| Safe area | `react-native-safe-area-context` | same |
| i18n | `i18next`, `react-i18next`, `expo-localization` | `i18next`, `react-i18next`, `react-native-localize` |
| Fonts | `expo-font`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono` | `.ttf` in `assets/fonts` + `npx react-native-asset` |
| PDF export (phase 1.5) | `expo-print` + `expo-sharing` | `react-native-html-to-pdf` + `react-native-share` |
| Tests | `jest`, `@testing-library/react-native` | same |

Wrap haptics and keep-awake in `src/features/level/platform/` (`haptics.ts`, `keepAwake.ts`)
so the rest of the code does not care which package is used.

Reanimated: add its Babel plugin (`react-native-reanimated/plugin` on v3,
`react-native-worklets/plugin` on v4) as the **last** plugin, then clear the Metro cache.

## 2. Folder structure

```
src/features/level/
  math/
    levelMath.ts              pure 'worklet' functions (sensor-math.md § 9)
    __tests__/levelMath.test.ts
  sensors/
    useLevelSensor.ts         sensor + frame callback → shared values (animation.md § 2)
    useLevelEvents.ts         reactions → JS (level reached, mode, stable)
  state/
    settingsStore.ts          tolerance, smoothing, units, frame width, haptics, language
    calibrationStore.ts       offsets per mode / edge, date, method
    readingsStore.ts          saved readings CRUD
    storage.ts                MMKV instance
  components/
    StatusLine.tsx  ModeTabs.tsx  AngleDial.tsx  AnimatedReadout.tsx  HintChip.tsx
    BubbleVial.tsx  BubbleTarget.tsx  AxisBar.tsx  TechPanel.tsx  Toolbar.tsx  ReadingRow.tsx
  screens/
    LevelScreen.tsx           Edge / Flat / Held states
    CalibrateScreen.tsx       modal
    ReadingsScreen.tsx        full saved list
    SettingsScreen.tsx
  platform/
    haptics.ts  keepAwake.ts
  theme/
    tokens.ts                 design-system.md § 1
  i18n/
    en.json  ur.json  index.ts
  index.ts                    export LevelStack
```

## 3. State

- **Shared values** (UI thread): everything measured per frame. Owned by `useLevelSensor`.
- **Small stores** (JS): settings, calibration, readings. Use Zustand **or** plain React
  context + MMKV; avoid Redux for this feature. Persist synchronously with MMKV.
- When a store value used on the UI thread changes (tolerance, offsets, smoothing), write it into
  the matching shared value in a `useEffect`.

### Data shapes

```ts
type Units = 'deg' | 'percent' | 'mmPerM' | 'ratio';
type Settings = {
  tolerance: 0.1 | 0.25 | 0.5 | 1;      // default 0.5
  smoothing: 'fast' | 'normal' | 'steady'; // τ 40 / 80 / 160 ms
  units: Units;                          // primary unit cycled by the Units button
  frameWidthMm: number;                  // default 600
  haptics: boolean;                      // default true
  degreeTicks: boolean;                  // default false
  keepAwake: boolean;                    // default true
  language: 'en' | 'ur';                 // default from device locale
};
type Calibration = {
  flat: { x: number; y: number };
  edge: [number, number, number, number];
  method: 'two-point' | 'zero' | 'none';
  date: string | null; // ISO
};
type Reading = {
  id: string; name: string; mode: 'edge' | 'flat' | 'table' | 'slope';
  angle: number; x?: number; y?: number; slopePct: number; sigma: number;
  createdAt: string; note?: string;
};
```

## 4. Navigation

```
LevelStack (native stack)
  Level        (default)
  Calibrate    presentation: 'fullScreenModal'
  Readings
  Settings
```
`LevelScreen` keeps the sensor running only while focused (`useIsFocused`), activates
keep-awake on focus and deactivates on blur. It stays mounted while Calibrate is open so the
calibration screen can reuse the same sensor hook instance (pass shared values via context).

## 5. i18n and Urdu

- All strings in `en.json` / `ur.json` with nested keys (`level.hint.raiseLeft`, …) and
  interpolation (`"Raise left side {{mm}} mm"`).
- Urdu is RTL. Use `I18nManager.allowRTL(true)`; switching direction needs an app reload
  (`expo-updates` `reloadAsync` or `react-native-restart`). Ask before reloading.
- Numbers, units, degree signs and the dial stay LTR (wrap numeric text with
  `writingDirection: 'ltr'`). Left/right words in hints must be the user's physical left/right,
  not mirrored.
- Starter keys (both files): `level.title`, `mode.edge`, `mode.flat`, `status.live`,
  `hint.level`, `hint.raiseLeft`, `hint.raiseRight`, `panel.title`, `panel.angle`,
  `panel.slope`, `panel.ratio`, `panel.rise`, `panel.over`, `panel.offset`, `panel.stable`,
  `panel.settling`, `toolbar.calibrate`, `toolbar.hold`, `toolbar.units`, `toolbar.save`,
  `calibrate.*`, `hold.*`, `readings.*`, `settings.*`.

## 6. Permissions and platform config

- Motion sensors need no runtime permission on Android or iOS. iOS does not require a
  `NSMotionUsageDescription` for raw accelerometer/gravity via CoreMotion device motion, but add
  one anyway if review asks ("Used to measure tilt for the level").
- Lock orientation to portrait.
- Android: request high sampling rate only while measuring; Android 12+ may cap at 200 Hz
  without `HIGH_SAMPLING_RATE_SENSORS`, which we do not need (100 Hz is enough).

## 7. Testing

- Unit tests for every function in `levelMath.ts` (list in sensor-math.md § 10).
- Component tests: `TechPanel` renders formatted values; `ModeTabs` calls `onChange`.
- Manual device checklist: pose table (sensor-math.md § 2), calibration round-trip against a
  known level surface, haptic once per entry, landscape edge rotation, Urdu layout, Reduce Motion,
  low-end Android frame rate.

## 8. Analytics and privacy

No account, no network needed for measuring. If analytics are added, log only anonymous feature
usage (mode used, calibration done), never readings with names.
