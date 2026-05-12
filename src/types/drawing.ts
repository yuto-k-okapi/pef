export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export type StrokeKind = 'pen' | 'pencil';

export interface Stroke {
  points: Point[];
  color: string;
  /** 'pen' = opaque ink, 'pencil' = semi-transparent. Defaults to 'pen' for legacy strokes. */
  kind?: StrokeKind;
  /** Line width in CSS pixels. Defaults to medium when missing. */
  width?: number;
  /** Overall ink opacity 0..1. Defaults to 1 for pen, settings.pencilAlpha for pencil. */
  alpha?: number;
}

export type Tool = 'pen' | 'pencil' | 'eraser' | 'lasso';
export type ColorKey =
  | 'red'
  | 'pink'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'black'
  | 'gray'
  | 'brown';
export type WidthKey = 'thin' | 'med' | 'thick';

export const COLORS: Record<ColorKey, string> = {
  red: '#dc2626',
  pink: '#ec4899',
  orange: '#ea580c',
  yellow: '#ca8a04',
  green: '#16a34a',
  teal: '#0d9488',
  blue: '#2563eb',
  indigo: '#4f46e5',
  purple: '#9333ea',
  black: '#1f2937',
  gray: '#6b7280',
  brown: '#854d0e',
};

export const ALL_COLOR_KEYS: ColorKey[] = [
  'red',
  'pink',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'black',
  'gray',
  'brown',
];

export const COLOR_NAMES: Record<ColorKey, string> = {
  red: '赤',
  pink: '桃',
  orange: '橙',
  yellow: '黄',
  green: '緑',
  teal: '青緑',
  blue: '青',
  indigo: '藍',
  purple: '紫',
  black: '黒',
  gray: '灰',
  brown: '茶',
};

// Legacy default palette (used as fallback when settings hasn't been
// initialised yet). The active palette lives in settings.paletteColors.
export const DEFAULT_PALETTE: ColorKey[] = ['red', 'blue', 'black', 'green'];

export const WIDTH_PX: Record<WidthKey, number> = {
  thin: 1.4,
  med: 2.4,
  thick: 4.2,
};

export const WIDTH_ORDER: WidthKey[] = ['thin', 'med', 'thick'];

export const PENCIL_ALPHA = 0.55;
