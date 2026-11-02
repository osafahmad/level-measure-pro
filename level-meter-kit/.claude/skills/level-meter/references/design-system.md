# Design system — Level

Look: a precision instrument. Dark ground, thin borders, flat surfaces, monospaced numbers.
No gradients, glows or drop shadows. Color carries meaning only (level state), never decoration.

## 1. Tokens — `src/features/level/theme/tokens.ts`

```ts
export const colors = {
  bg: '#0B0D10',            // screen background
  surface: '#13161B',       // cards, toolbar buttons, vial, target
  surfaceInset: '#0F1215',  // cells inside a card (raw sensor values)
  track: '#1A1E24',         // axis bar track
  chip: '#232A33',          // active segment in mode tabs
  border: '#1E232B',        // card borders, row dividers
  borderStrong: '#232830',  // button borders
  borderVial: '#2A313B',    // vial / target border when not level

  text: '#E8EBEF',          // primary text, primary button bg
  textSecondary: '#AEB6C2', // card titles (TECHNICAL DATA)
  textMuted: '#8A93A0',     // labels, status line
  textFaint: '#6B7482',     // diagnostics, scale labels

  tickMinor: '#3A424E',
  tickMajor: '#8A93A0',
  mark: '#4A5462',          // vial center marks, axis center line
  dialTrack: '#1E232B',

  ok: '#3DDC97',            // level (inside tolerance)
  warn: '#FFB547',          // close (tolerance .. 3°)
  bad: '#FF7A45',           // off (> 3°)
  info: '#5AB8FF',          // held reading
  onOk: '#052E1F',          // text on ok fill
  onInfo: '#06233A',        // text on info fill
  onPrimary: '#0B0D10',     // text on the light primary button

  okTint: 'rgba(61,220,151,0.14)',
  warnTint: 'rgba(255,181,71,0.14)',
  badTint: 'rgba(255,122,69,0.14)',
  infoTint: 'rgba(90,184,255,0.14)',
  bubbleShine: 'rgba(255,255,255,0.45)',
} as const;

export const fonts = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemi: 'JetBrainsMono_600SemiBold',
} as const;

export const type = {
  title: { fontFamily: fonts.sansSemi, fontSize: 20, letterSpacing: -0.2 },
  h2: { fontFamily: fonts.sansSemi, fontSize: 18 },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.sans, fontSize: 11 },
  button: { fontFamily: fonts.sansMedium, fontSize: 12 },
  cardTitle: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 0.6 },
  overline: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1 },
  readoutXL: { fontFamily: fonts.monoSemi, fontSize: 64, letterSpacing: -2 },   // edge
  readoutL: { fontFamily: fonts.monoSemi, fontSize: 52, letterSpacing: -2 },    // flat
  readoutHeld: { fontFamily: fonts.monoSemi, fontSize: 76, letterSpacing: -2 }, // hold
  value: { fontFamily: fonts.monoMedium, fontSize: 15 },
  valueSm: { fontFamily: fonts.monoMedium, fontSize: 13 },
  diag: { fontFamily: fonts.mono, fontSize: 11 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { pill: 999, card: 16, button: 14, segment: 12, segmentInner: 9, cell: 10, vial: 28 } as const;
export const size = { touch: 44, toolbarButton: 60, primaryButton: 56, vialHeight: 56, bubbleEdgeW: 84, bubbleEdgeH: 39, bubbleFlat: 44, target: 260, dialW: 350, dialH: 200 } as const;
```

Every numeric style uses `fontVariant: ['tabular-nums']`.

### Level state → color

| State | Condition (default tolerance 0.5°) | Color | Tint (chip bg) |
|---|---|---|---|
| Level | `abs < tolerance` | `ok` | `okTint` |
| Close | `tolerance ≤ abs < 3°` | `warn` | `warnTint` |
| Off | `abs ≥ 3°` | `bad` | `badTint` |
| Held | hold active | `info` | `infoTint` |

Tolerance is a user setting: 0.1°, 0.25°, 0.5° (default) or 1.0°.

### Fonts

Inter and JetBrains Mono (both SIL Open Font License). Expo: `@expo-google-fonts/inter`,
`@expo-google-fonts/jetbrains-mono`. Bare RN: put the `.ttf` files in `assets/fonts` and link with
`npx react-native-asset`. On Android the family name must equal the file name; keep the names in
`fonts` above in sync with the files.

## 2. Components — `src/features/level/components/`

| Component | Purpose | Key props |
|---|---|---|
| `StatusLine` | Green dot + `LIVE · 100 Hz · ±0.1°` (mono 11, textMuted) | `rateHz`, `accuracy`, `live` |
| `ModeTabs` | Segmented control, 2 equal segments now (Edge, Flat), extendable to 4 | `value`, `onChange` |
| `AngleDial` | Semicircle dial ±15°, static SVG + animated needle | `angle: SharedValue<number>`, `tolerance` |
| `AnimatedReadout` | Big UI-thread number, colored by state | `value: SharedValue<number>`, `decimals`, `style` |
| `HintChip` | Pill with dot + instruction ("Raise left side 25 mm") | `text`, `state` |
| `BubbleVial` | Horizontal tube 350×56 with bubble, center marks | `angle: SharedValue<number>`, `velocity` |
| `BubbleTarget` | 260 px circle, rings at 1°/3°/5°, crosshair, bubble | `x`, `y` shared values |
| `AxisBar` | `X` / `Y` label, track with center mark and marker, signed value | `value: SharedValue<number>`, `label` |
| `TechPanel` | Card: title row + 3-column grid of label/value cells + optional diagnostics row | `cells`, `status`, `diagnostics` |
| `Toolbar` | 4 equal buttons: Calibrate, Hold (primary), Units (°/%), Save | handlers |
| `ReadingRow` | Name + mono meta line + colored value | `reading` |

Buttons: height 60, radius 14, `surface` bg + 1 px `borderStrong`, icon 18 above 12 px label.
The single primary button (Hold) is `text` bg with `onPrimary` text. Icons: stroke icons,
1.8 px stroke (e.g. `lucide-react-native` or `react-native-svg` paths).

### AngleDial geometry (viewBox 350×200)

- Center `cx=175, cy=190`. Display angle `a` maps to dial angle `θ = a × 6°` (±15° → ±90°).
- Point at radius r: `x = cx + r·sin θ`, `y = cy − r·cos θ`.
- Track arc r=158, stroke 10, `dialTrack`. Warn bands from ±tolerance to ±3° in `warn` at 35 %
  opacity. Ok band −tolerance..+tolerance in `ok`.
- Ticks every 1° from −15 to 15: minor r 150→141 (`tickMinor`, 1.2 px), major every 5° r 150→132
  (`tickMajor`, 2 px). Labels 10, 5, 0, 5, 10 at r=118, mono 10 px, `0` in `text`, others `textFaint`.
- Needle: line from r=104 to r=158, 3 px, round cap, tip dot r=5, both in state color.
  Implement as an `Animated.View` rotated around the dial center (see animation.md), not by
  re-rendering SVG.
- Readout sits inside the arc, bottom-centered, with overline `EDGE · ROLL` beneath.

### BubbleVial geometry

Width 350, height 56, radius 28, `surface` bg, 1.5 px border (`borderVial`, `ok` when level).
Center marks: 2×40 px lines at x=129 and x=217 (`mark`). Bubble 84×39, radius 20, top 7,
resting left = 131. Travel ±118 px for ±10° (clamped). Shine: 26×7 pill, offset +14/+5 from
bubble, `bubbleShine`.

### BubbleTarget geometry

260 px circle, `surface`, 1.5 px border. Rings (1 px, `borderVial`): 5° radius 115, 3° radius 69;
1° ring radius 23 dashed `ok`. Crosshair lines through center, `chip` color. Edge ticks every 10°
(long every 90°). Scale 23 px per degree; bubble (44 px) clamped to radius 115. Center reticle
10 px ring, 2 px `text`. Ring labels `5°`, `3°` mono 10 px `textFaint`.

## 3. Screens

All screens: background `bg`, horizontal padding 20, top padding = safe area + 10, bottom
padding = safe area + 12. Content column, toolbar pinned to bottom with a flexible spacer.

### 3.1 Level — Edge mode (default)
Order top to bottom:
1. Header row: title "Level" + `StatusLine` beneath; right: Settings icon button (44, surface, borderStrong).
2. `ModeTabs` (Edge active), margin-top 16.
3. `AngleDial` with `AnimatedReadout` (readoutXL) inside, margin-top 20.
4. `HintChip`, centered, margin-top 10. Texts:
   - level: "Level · within ±{tol}°"
   - positive angle: "Raise left side {mm} mm"; negative: "Raise right side {mm} mm"
   - mm = tan(|a|) × frameWidth (Settings, default 60 cm).
5. `BubbleVial`, margin-top 18.
6. `TechPanel`, margin-top 16. Title "TECHNICAL DATA", status at right ("Stable" in ok, or
   "Settling…" in warn while σ is high; "Stable · haptic sent" right after the level haptic).
   Cells: Angle (2 dp °), Slope (%), Ratio (1:X), Rise (mm/m), Over {frame} cm (mm), Offset (°).
   Diagnostics row: `ROLL ±x.xx°  PITCH ±x.xx°  σ x.xx°  g 9.81`.
7. Spacer, then `Toolbar`.

When level: needle, readout, chip, vial border and bubble turn `ok`; haptic once.

### 3.2 Level — Flat mode
1. Header + tabs (Flat active).
2. Row: left = overline `FLAT · TOTAL TILT` + readoutL total; right = "High side" label +
   rotating arrow + compass sector and bearing (`NE 48°`, or `—` when level).
3. `BubbleTarget`, centered, margin-top 16.
4. Two `AxisBar`s (X, Y), gap 8. Marker spans ±5° across the track.
5. `TechPanel` cells: Total, Slope, Rise, Ratio, Offset X, Offset Y; header right shows `σ · g`.
6. Toolbar.

### 3.3 Calibration (modal, full screen)
1. Close button (44) + title "Calibration" + overline `TWO-POINT · STEP n OF 2`.
2. Progress: 2 segments, 4 px, done = ok, pending = chip.
3. Illustration (phone with rotate arrows, stroke icon 96 px) + h2 instruction + body text.
   Step 1: "Place the phone on a flat surface". Step 2: "Turn the phone 180°".
4. Card "LIVE SENSOR · m/s²": 3 inset cells gx, gy, gz (3 dp, signed); status "Still"/"Moving";
   footer `NOISE σ · RATE · WINDOW 2 s`.
5. Card with rows: Reading A · 0° (check + values), Reading B · 180° (step number + "waiting…"),
   Σ New offset = (A + B) ÷ 2 (result when both captured).
6. Footer note: current offset and last calibrated date.
7. Buttons: "Reset to factory" (secondary) and "Capture" (ok fill, flex 1.4). Capture is
   disabled-looking only while "Moving"; tapping it then shows "Hold the phone still".

### 3.4 Reading held
Shown when Hold is on (same route, different state).
1. Header: title + status line `LIVE {live}° · 100 Hz`; right: "Held" pill (info tint + lock icon).
2. Overline `{MODE} · HELD hh:mm:ss`, readoutHeld in `info`, caption "Averaged from N samples · σ".
3. Detail card rows (label left textMuted 13, value right mono 14): Angle, Slope, Rise, Ratio,
   Correction over {frame} cm (+ direction), Calibration offset.
4. "SAVED READINGS" card: last 2 readings + "See all".
5. Buttons: Export PDF, Save, Release (info fill).

### 3.5 Phase 2 screens (see spec § Roadmap)
Table mode and Slope mode reuse the same header, tabs (4 segments), `TechPanel` and toolbar.
