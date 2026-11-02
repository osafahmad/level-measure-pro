import { create } from 'zustand';
import type { Units } from '../math/levelMath';
import { deviceLanguage, type Language } from '../i18n';
import { readJSON, writeJSON } from './storage';

export type Tolerance = 0.1 | 0.25 | 0.5 | 1;
export type Smoothing = 'fast' | 'normal' | 'steady';

export type Settings = {
  tolerance: Tolerance;
  smoothing: Smoothing;
  units: Units;
  frameWidthMm: number;
  haptics: boolean;
  degreeTicks: boolean;
  keepAwake: boolean;
  language: Language;
};

export const TOLERANCES: Tolerance[] = [0.1, 0.25, 0.5, 1];
export const SMOOTHINGS: Smoothing[] = ['fast', 'normal', 'steady'];
export const SMOOTHING_TAU: Record<Smoothing, number> = { fast: 40, normal: 80, steady: 160 };
export const FRAME_WIDTH_MIN_MM = 50;
export const FRAME_WIDTH_MAX_MM = 5000;

const KEY = 'settings.v1';

const defaults: Settings = {
  tolerance: 0.5,
  smoothing: 'normal',
  units: 'deg',
  frameWidthMm: 600,
  haptics: true,
  degreeTicks: false,
  keepAwake: true,
  language: deviceLanguage(),
};

type SettingsStore = Settings & { update: (patch: Partial<Settings>) => void };

export const useSettings = create<SettingsStore>((set, get) => ({
  ...readJSON(KEY, defaults),
  update: patch => {
    set(patch);
    const { tolerance, smoothing, units, frameWidthMm, haptics, degreeTicks, keepAwake, language } = get();
    writeJSON(KEY, { tolerance, smoothing, units, frameWidthMm, haptics, degreeTicks, keepAwake, language });
  },
}));
