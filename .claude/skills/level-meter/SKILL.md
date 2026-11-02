---
name: level-meter
description: Build, extend or fix the Level feature (digital bubble level / inclinometer) in this React Native app — sensor reading, tilt math, calibration, Reanimated animations, screens and design tokens. Use for any work on Edge, Flat, Table or Slope mode, the angle dial, bubble vial, technical data panel, hold/saved readings or calibration.
---

# Level meter skill

This skill describes how to build the **Level** feature of this React Native app: a professional
digital level that helps people hang frames straight, level tables (snooker, pool, foosball) and
check floor slope (bathrooms, roofs, ramps).

The full product spec is in `docs/LEVEL_APP_SPEC.md`. Read it once before starting a new phase.
Detailed rules live in the reference files next to this one; open the one that matches the task:

| Task | Read |
|---|---|
| Colors, fonts, spacing, components, screen layouts | `references/design-system.md` |
| Sensor axes, tilt formulas, filtering, calibration, units | `references/sensor-math.md` |
| Reanimated setup, springs, 60–120 fps rules | `references/animation.md` |
| Folders, dependencies, state, storage, i18n, tests | `references/architecture.md` |

## Non-negotiable rules

1. **Per-frame work runs on the UI thread.** Read the sensor with Reanimated's `useAnimatedSensor`,
   process it in `useFrameCallback`, keep results in shared values. Never call `setState` per
   sensor sample or per frame.
2. **React state only for discrete events**: mode change, hold on/off, level reached, screen
   navigation. Cross from the UI thread with `runOnJS` (Reanimated 3) or `scheduleOnRN`
   (Reanimated 4 / react-native-worklets), and only when the value actually changes.
3. **All math lives in `src/features/level/math/levelMath.ts`** as pure functions marked
   `'worklet'`. Components never compute angles themselves. Every function there has a unit test.
4. **Sign conventions are verified on a real device**, never assumed. Use the pose table in
   `references/sensor-math.md` and the platform constants in `levelMath.ts`. Simulators have no
   real gravity sensor.
5. **Design tokens only.** Every color, font, radius and spacing value comes from
   `src/features/level/theme/tokens.ts`. No raw hex values in components.
6. **Numbers use the mono font with tabular figures** so readouts do not jitter in width.
7. **No ads or paywall prompts on the measuring screens.** The measurement UI stays clean.
8. **Accessibility**: every control is a real `Pressable` with `accessibilityRole` and
   `accessibilityLabel`; touch targets are at least 44×44; respect Reduce Motion.
9. **Every user-facing string goes through i18n** (`en` and `ur` from day one). Numbers and units
   stay left-to-right even in Urdu.

## Workflow for a new piece of work

1. Identify the phase and screen in `docs/LEVEL_APP_SPEC.md` (§ Screens, § Roadmap).
2. Check which existing components can be reused (`src/features/level/components/`).
3. If the work touches tilt values, add or update the pure function and its test **first**.
4. Build the component with tokens from `tokens.ts` and the layout from `design-system.md`.
5. Wire animation following `animation.md` (shared values in, animated styles out).
6. Run the checklist below before calling it done.

## Done checklist

- [ ] Math functions have unit tests covering 0°, small positive/negative, ±45° wrap and clamps.
- [ ] No `setState` inside sensor/frame callbacks; React DevTools shows no re-render per frame.
- [ ] Readouts use `AnimatedReadout` (UI-thread text), not a `<Text>` re-rendered from state.
- [ ] Colors change through `interpolateColor` / tokens, thresholds from settings.
- [ ] Haptic fires once on entering level and not again until the reading leaves the exit band.
- [ ] Screen stays awake while measuring (keep-awake) and releases it on blur.
- [ ] Edge mode rotates its content when the phone is turned to landscape.
- [ ] Strings exist in `en.json` and `ur.json`; Urdu layout checked.
- [ ] Reduce Motion: springs replaced with short timings, no bubble stretch.
- [ ] Tested on a physical Android and iPhone against the pose table.
