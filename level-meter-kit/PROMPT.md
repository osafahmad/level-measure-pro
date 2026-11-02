# Kickoff prompt — Level app

## Where these files go

Copy into the root of your React Native project, keeping the paths:

```
your-app/
  .claude/skills/level-meter/SKILL.md
  .claude/skills/level-meter/references/design-system.md
  .claude/skills/level-meter/references/sensor-math.md
  .claude/skills/level-meter/references/animation.md
  .claude/skills/level-meter/references/architecture.md
  docs/LEVEL_APP_SPEC.md
  PROMPT.md   (this file — optional to keep)
```

Claude Code picks up the skill automatically from `.claude/skills/`. With other AI coding tools,
attach `SKILL.md`, the four reference files and the spec to the chat.

## Prompt to paste (Phase 1)

> Use the **level-meter** skill. Read `docs/LEVEL_APP_SPEC.md` and every file in
> `.claude/skills/level-meter/references/` before writing code.
>
> Build **Phase 1** of the Level feature in this React Native project.
>
> First, inspect the project and tell me: Expo or bare, React Native version, Reanimated
> version, navigation already in use, TypeScript or not. Then propose the exact packages you will
> install (from architecture.md § 1) and wait for my OK before installing.
>
> After I approve, work in this order and show me progress after each step:
> 1. Install and configure dependencies (Reanimated Babel plugin last, fonts, MMKV), lock the app
>    to portrait.
> 2. `theme/tokens.ts` exactly as in design-system.md § 1.
> 3. `math/levelMath.ts` from sensor-math.md § 9 and its unit tests from § 10. Run the tests.
> 4. `sensors/useLevelSensor.ts` and `useLevelEvents.ts` from animation.md, plus a `__DEV__`-only
>    debug overlay that shows raw and normalized x, y, z so I can do the pose test.
> 5. Components: StatusLine, ModeTabs, AngleDial, AnimatedReadout, HintChip, BubbleVial,
>    BubbleTarget, AxisBar, TechPanel, Toolbar, ReadingRow.
> 6. Screens: LevelScreen (Edge, Flat, Held states), CalibrateScreen (modal), ReadingsScreen,
>    SettingsScreen, and the navigation stack.
> 7. Stores with MMKV: settings, calibration, readings.
> 8. i18n with `en.json` and `ur.json` for every string.
> 9. Haptics, keep-awake, Reduce Motion handling, accessibility labels.
>
> Rules: follow the skill's non-negotiable rules and done checklist. No per-frame `setState`. No
> raw hex colors outside `tokens.ts`. Do not invent features outside Phase 1. If something in the
> docs is unclear or conflicts with my project, ask me instead of guessing.
>
> When done, give me the pose-test steps for a physical Android phone and iPhone, and tell me
> which `SIGN` constants to change if a pose does not match.

## Prompts for later phases

**Phase 1.5:** "Use the level-meter skill. Add PDF export for held and saved readings and the
3-card onboarding from the spec § 4 Phase 1.5."

**Phase 2 — Table mode:** "Use the level-meter skill. Add Table mode from spec § 4 Phase 2 and
sensor-math.md § 8. Mode tabs become Edge, Flat, Table, Slope. Show a top-view table with each
leg's correction in mm and an up arrow; the highest leg shows 0. Include presets and a custom
size. Add unit tests for `tableLegCorrections`. Design the screen with tokens and components from
design-system.md."

**Phase 2 — Slope mode:** "Use the level-meter skill. Add Slope mode from spec § 4 Phase 2 and
sensor-math.md § 8: primary unit %, target slope with tolerance, water-flow arrow toward the low
side, and a drop-over-distance calculator."

**Fix or polish:** "Use the level-meter skill. [Describe the problem]. Check the done checklist
in SKILL.md after the change."
