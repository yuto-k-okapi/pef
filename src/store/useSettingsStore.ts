import { create } from 'zustand';

export type ScribbleSensitivity = 'off' | 'strict' | 'normal' | 'loose';

export interface ScribbleThresholds {
  minPoints: number;
  minPathLength: number;
  minBboxDiagonal: number;
  minCompactness: number;
  minReversals: number;
}

export const SCRIBBLE_THRESHOLDS: Record<
  Exclude<ScribbleSensitivity, 'off'>,
  ScribbleThresholds
> = {
  strict: {
    minPoints: 12,
    minPathLength: 120,
    minBboxDiagonal: 30,
    minCompactness: 3.5,
    minReversals: 12,
  },
  normal: {
    minPoints: 10,
    minPathLength: 90,
    minBboxDiagonal: 25,
    minCompactness: 3.0,
    minReversals: 8,
  },
  loose: {
    minPoints: 8,
    minPathLength: 60,
    minBboxDiagonal: 20,
    minCompactness: 2.5,
    minReversals: 5,
  },
};

export function thresholdsFor(s: ScribbleSensitivity): ScribbleThresholds | null {
  return s === 'off' ? null : SCRIBBLE_THRESHOLDS[s];
}

export interface Settings {
  widthThin: number;
  widthMed: number;
  widthThick: number;
  eraserRadius: number;
  pencilAlpha: number;
  scribbleSensitivity: ScribbleSensitivity;
}

export const DEFAULT_SETTINGS: Settings = {
  widthThin: 1.4,
  widthMed: 2.4,
  widthThick: 4.2,
  eraserRadius: 5,
  pencilAlpha: 0.55,
  scribbleSensitivity: 'strict',
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
        eraserRadius: next.eraserRadius,
        pencilAlpha: next.pencilAlpha,
        scribbleSensitivity: next.scribbleSensitivity,
      });
      return next;
    }),
  reset: () => {
    persist(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));

import type { WidthKey } from '../types/drawing';

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
