import { I18nManager } from 'react-native';

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
  scrim: 'rgba(0,0,0,0.6)', // behind the save-reading sheet
} as const;

// Bare React Native: iOS resolves fontFamily by PostScript name and Android by file name, so the
// .ttf files in assets/fonts are named after their PostScript names and these values match both.
export const fonts = {
  sans: 'Inter-Regular',
  sansMedium: 'Inter-Medium',
  sansSemi: 'Inter-SemiBold',
  mono: 'JetBrainsMono-Regular',
  monoMedium: 'JetBrainsMono-Medium',
  monoSemi: 'JetBrainsMono-SemiBold',
} as const;

const tabular = { fontVariant: ['tabular-nums' as const] };
// Urdu (RTL) letters must join: labels that mix words with numbers drop letter-spacing and the
// mono font there. Direction is fixed for the app's lifetime, so this is resolved once at load.
const rtl = I18nManager.isRTL;

export const type = {
  title: { fontFamily: fonts.sansSemi, fontSize: 20, letterSpacing: -0.2 },
  h2: { fontFamily: fonts.sansSemi, fontSize: 18 },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.sans, fontSize: 11 },
  button: { fontFamily: fonts.sansMedium, fontSize: 12 },
  cardTitle: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: rtl ? 0 : 0.6 },
  overline: { fontFamily: rtl ? fonts.sans : fonts.mono, fontSize: 11, letterSpacing: rtl ? 0 : 1, ...tabular },
  readoutXL: { fontFamily: fonts.monoSemi, fontSize: 64, letterSpacing: -2, ...tabular },   // edge
  readoutL: { fontFamily: fonts.monoSemi, fontSize: 52, letterSpacing: -2, ...tabular },    // flat
  readoutHeld: { fontFamily: fonts.monoSemi, fontSize: 76, letterSpacing: -2, ...tabular }, // hold
  value: { fontFamily: fonts.monoMedium, fontSize: 15, ...tabular },
  valueSm: { fontFamily: fonts.monoMedium, fontSize: 13, ...tabular },
  diag: { fontFamily: fonts.mono, fontSize: 11, ...tabular },
  /** Status line: words + numbers (mono in LTR, sans in RTL). */
  status: { fontFamily: rtl ? fonts.sans : fonts.mono, fontSize: 11, ...tabular },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { pill: 999, card: 16, button: 14, segment: 12, segmentInner: 9, cell: 10, vial: 28 } as const;
export const size = { touch: 44, toolbarButton: 60, primaryButton: 56, vialHeight: 56, bubbleEdgeW: 84, bubbleEdgeH: 39, bubbleFlat: 44, target: 260, dialW: 350, dialH: 200 } as const;

/** Numeric text stays left-to-right in Urdu. */
export const ltr = { writingDirection: 'ltr' as const };
