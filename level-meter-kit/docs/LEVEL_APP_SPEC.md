# Level — product spec

Working name: **Level** (store name idea: "Level Pro: Bubble, Slope & Table").
Platform: React Native, Android + iOS. Languages: English and Urdu at launch.

## 1. Vision

A professional digital level for home and construction work. It does not only show degrees; it
tells the user **what to do**: "Raise left side 25 mm", "Raise back legs 18.7 mm",
"Floor slope 1.5 % toward the drain".

## 2. Users and use cases

| User | Use case | Mode |
|---|---|---|
| Home user | Hang a photo frame, mirror, shelf or TV straight | Edge |
| Home user | Check a table, washing machine, fridge or bed | Flat |
| Snooker / pool / foosball owner or club | Level the playing surface leg by leg | Table (phase 2) |
| Mistri, plumber, tiler, contractor | Bathroom floor fall to drain, roof, ramp, porch | Slope (phase 2) |
| Photographer | Level a tripod or camera | Flat |

## 3. Market and positioning

App Store check (Oct 2026) of typical competitors: Bubble Level + Spirit Level (4.4, 35 ratings,
free + weekly sub or $19.99 lifetime), Bubble Level – Measure Tool (4.5, 63 ratings, ads + subs
up to $49.99/yr), Bubble level and Clinometer (4.2, 10 ratings, slope units, dated UI),
Leveler Plus (5.0, 1 rating, $2.99, saved readings + haptics). Also: Plaincode Clinometer and the
iPhone's built-in Measure app (Level).

Gaps we fill:
1. Action-oriented hints in mm (frames, table legs), not just degrees.
2. Table mode with per-leg corrections — not found in competitors.
3. Slope units (%, mm/m, 1:X) with water-flow direction, in a modern UI.
4. Urdu (and later Hindi) — not found in competitors.
5. No weekly subscription. Free core level, one-time "Pro" unlock.
6. UI that rotates with the phone (a competitor review complained about this).

## 4. Features by phase

### Phase 1 — MVP
- Edge mode: dial ±15°, bubble vial, hint with mm correction, technical data panel.
- Flat mode: target with rings, X/Y bars, high side compass, technical data panel.
- Automatic Edge ↔ Flat switching by phone pose (tabs also switch manually and pin the mode
  until the user taps "Auto").
- Edge UI rotates to the edge that is down (portrait / landscape both ways).
- Two-point calibration + quick zero, per mode and per edge; reset to factory.
- Hold (freeze averaged reading), Release.
- Units button cycles primary unit: ° → % → mm/m → 1:X.
- Haptic on reaching level (with hysteresis), optional degree ticks.
- Saved readings with name, mode, value, time; list screen with delete.
- Settings: tolerance, smoothing, frame width, haptics, degree ticks, keep awake, language.
- English + Urdu.

### Phase 1.5
- Export held / saved readings as a one-page PDF report (share sheet).
- Onboarding: 3 cards (Edge, Flat, Calibrate) shown on first launch.

### Phase 2
- **Table mode**: preset or custom size, phone in the center, top-view table drawing with each
  leg's correction in mm and an up/down arrow; "re-measure" loop until all legs ≤ 0.5 mm.
- **Slope mode**: primary unit %, target slope with tolerance, water-flow arrow, "drop over
  distance" calculator.
- Mode tabs grow to four: Edge, Flat, Table, Slope.

### Phase 3
- Camera mode: AR horizon line over the camera for leveling from a distance.
- Pro unlock (one-time): Table, Slope, PDF export, unlimited saved readings. Free tier keeps
  Edge, Flat, calibration and 5 saved readings.
- Hindi, Arabic.

## 5. Screens

Phase 1 screens and exact layout are in `.claude/skills/level-meter/references/design-system.md` § 3:
1. Level — Edge mode (tilted and level states)
2. Level — Flat mode
3. Calibration (modal)
4. Reading held
5. Saved readings list (rows as in Held screen card, swipe to delete, tap to view details)
6. Settings (grouped list: Measurement, Feedback, Display, Language, About)

Settings items: Tolerance (0.1 / 0.25 / 0.5 / 1.0°), Smoothing (Fast / Normal / Steady),
Frame width (cm), Haptics (on/off), Degree ticks (on/off), Keep screen awake (on/off),
Default units, Language (English / اردو), Calibration (opens Calibrate), Reset calibration,
About (version, accuracy note, privacy).

## 6. Accuracy and honesty

- Display precision: 0.1° main readout, 0.01° in the technical panel.
- Show "±0.1°" in the status line only after calibration; before calibration show "±0.5°"
  and a one-line suggestion to calibrate.
- Phone length is ~15 cm. For floors and long surfaces, the app suggests placing the phone on a
  1–2 m straight edge.
- About screen note: phone levels are for guidance; for structural work verify with a
  professional instrument.

## 7. Acceptance criteria (Phase 1)

1. On a calibrated phone on a surface verified level by a spirit level, Edge and Flat read
   ≤ 0.1° after settling (≤ 1 s).
2. Rotating the phone 180° on the same spot changes the reading by ≤ 0.2° after calibration.
3. Animations hold 60 fps on a 2 GB RAM Android device; JS thread is idle while measuring.
4. Level haptic fires exactly once per entry into the tolerance band.
5. Auto mode switches Edge ↔ Flat without flicker when the phone is held at the boundary.
6. All strings translated in Urdu; numbers remain LTR and readable.
7. Calibration and saved readings survive app restart.
8. App works fully offline; no permission prompts.

## 8. Store listing notes

- Keywords: level, bubble level, spirit level, inclinometer, clinometer, slope, angle, floor
  slope, table level, snooker table, frame, tile, mistri, dhalwan, farsh.
- Screenshots: Edge tilted with hint, Edge level (green), Flat, Technical data close-up,
  Calibration, Urdu screen.
- Promise in the first line: "Hang frames straight and level tables and floors — it tells you
  how many millimetres to fix."
