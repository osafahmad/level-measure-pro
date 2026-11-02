import { create } from 'zustand';
import { readJSON, writeJSON } from './storage';

export type Reading = {
  id: string;
  name: string;
  mode: 'edge' | 'flat' | 'table' | 'slope';
  angle: number;
  x?: number;
  y?: number;
  slopePct: number;
  sigma: number;
  createdAt: string;
  note?: string;
};

const KEY = 'readings.v1';

type ReadingsStore = {
  readings: Reading[];
  add: (r: Omit<Reading, 'id' | 'createdAt'>) => Reading;
  remove: (id: string) => void;
};

export const useReadings = create<ReadingsStore>((set, get) => ({
  readings: readJSON<{ readings: Reading[] }>(KEY, { readings: [] }).readings,
  add: r => {
    const reading: Reading = {
      ...r,
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    const readings = [reading, ...get().readings];
    set({ readings });
    writeJSON(KEY, { readings });
    return reading;
  },
  remove: id => {
    const readings = get().readings.filter(r => r.id !== id);
    set({ readings });
    writeJSON(KEY, { readings });
  },
}));
