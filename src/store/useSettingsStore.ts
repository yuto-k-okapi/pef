import { create } from 'zustand';
import type { ColorKey, WidthKey } from '../types/drawing';
import { DEFAULT_PALETTE } from '../types/drawing';

export interface ScribbleThresholds {
  minPoints: number;
  minPathLength: number;
  minBboxDiagonal: number;
  minCompactness: number;
  minReversals: number;
}

// Fixed lower bounds — not user-tunable to keep the UI focused on the two
// values that actually shape the heuristic.
const SCRIBBLE_FIXED = {
  minPoints: 8,
  minPathLength: 80,
  minBboxDiagonal: 25,
};

export interface Settings {
  // Pen widths (the 3 slots shown in the palette)
  widthThin: number;
  widthMed: number;
  widthThick: number;
  // The 4 color slots shown in the palette
  paletteColors: ColorKey[];
  // Pencil
  pencilAlpha: number;
  pencilEnabled: boolean;
  // Eraser
  eraserRadius: number;
  // Scribble auto-erase
  scribbleEnabled: boolean;
  scribbleMinReversals: number;
  scribbleMinCompactness: number;
}

export const DEFAULT_SETTINGS: Settings = {
  widthThin: 1.4,
  widthMed: 2.4,
  widthThick: 4.2,
  paletteColors: [...DEFAULT_PALETTE],
  pencilAlpha: 0.55,
  pencilEnabled: true,
  eraserRadius: 5,
  scribbleEnabled: true,
  scribbleMinReversals: 12,
  scribbleMinCompactness: 3.5,
};

const STORAGE_KEY = 'pdf-writer-settings';

function loadFromStorage(): Settings {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const parsed = JSON.parse(v) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function persist(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...loadFromStorage(),
  update: (patch) =>
    set((s) => {
      const next = { ...s, ...patch };
      persist({
        widthThin: next.widthThin,
        widthMed: next.widthMed,
        widthThick: next.widthThick,
        paletteColors: next.paletteColors,
        pencilAlpha: next.pencilAlpha,
        pencilEnabled: next.pencilEnabled,
        eraserRadius: next.eraserRadius,
        scribbleEnabled: next.scribbleEnabled,
        scribbleMinReversals: next.scribbleMinReversals,
        scribbleMinCompactness: next.scribbleMinCompactness,
      });
      return next;
    }),
  reset: () => {
    persist(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));

export function widthValue(key: WidthKey, settings: Settings): number {
  switch (key) {
    case 'thin':
      return settings.widthThin;
    case 'med':
      return settings.widthMed;
    case 'thick':
      return settings.widthThick;
  }
}

export function scribbleThresholdsFrom(s: Settings): ScribbleThresholds | null {
  if (!s.scribbleEnabled) return null;
  return {
    ...SCRIBBLE_FIXED,
    minCompactness: s.scribbleMinCompactness,
    minReversals: s.scribbleMinReversals,
  };
}
