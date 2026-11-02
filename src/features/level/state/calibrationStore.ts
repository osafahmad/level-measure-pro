import { create } from 'zustand';
import { readJSON, writeJSON } from './storage';

export type Calibration = {
  flat: { x: number; y: number };
  edge: [number, number, number, number];
  method: 'two-point' | 'zero' | 'none';
  date: string | null; // ISO
};

const KEY = 'calibration.v1';

export const FACTORY: Calibration = {
  flat: { x: 0, y: 0 },
  edge: [0, 0, 0, 0],
  method: 'none',
  date: null,
};

type CalibrationStore = Calibration & {
  setFlat: (x: number, y: number, method: 'two-point' | 'zero') => void;
  setEdge: (q: number, offset: number, method: 'two-point' | 'zero') => void;
  reset: () => void;
};

function persist(c: Calibration) {
  writeJSON(KEY, { flat: c.flat, edge: c.edge, method: c.method, date: c.date });
}

export const useCalibration = create<CalibrationStore>((set, get) => ({
  ...readJSON(KEY, FACTORY),
  setFlat: (x, y, method) => {
    set({ flat: { x, y }, method, date: new Date().toISOString() });
    persist(get());
  },
  setEdge: (q, offset, method) => {
    const edge = [...get().edge] as Calibration['edge'];
    edge[q] = offset;
    set({ edge, method, date: new Date().toISOString() });
    persist(get());
  },
  reset: () => {
    set(FACTORY);
    persist(FACTORY);
  },
}));
