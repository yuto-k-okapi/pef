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

const SCRIBBLE_FIXED = {
  minPoints: 8,
  minPathLength: 80,
  minBboxDiagonal: 25,
};

export type EraserSize = 'small' | 'med' | 'large';
export const ERASER_SIZE_PX: Record<EraserSize, number> = {
  small: 4,
  med: 8,
  large: 14,
};
export const ERASER_SIZE_ORDER: EraserSize[] = ['small', 'med', 'large'];

export type PencilDarkness = 'light' | 'med' | 'dark';
export const PENCIL_ALPHA_VALUE: Record<PencilDarkness, number> = {
  light: 0.3,
  med: 0.55,
  dark: 0.85,
};
export const PENCIL_DARKNESS_ORDER: PencilDarkness[] = ['light', 'med', 'dark'];

export interface Settings {
  // Pen widths (3 slots shown in the palette)
  widthThin: number;
  widthMed: number;
  widthThick: number;
  // The 4 color slots shown in the palette
  paletteColors: ColorKey[];
  // Selected presets from the toolbar (persisted across sessions)
  eraserSize: EraserSize;
  pencilDarkness: PencilDarkness;
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
  eraserSize: 'med',
  pencilDarkness: 'med',
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
        eraserSize: next.eraserSize,
        pencilDarkness: next.pencilDarkness,
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
