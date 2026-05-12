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

export type Tool = 'pen' | 'pencil' | 'eraser';
export type ColorKey = 'red' | 'blue' | 'black' | 'green';
export type WidthKey = 'thin' | 'med' | 'thick';

export const COLORS: Record<ColorKey, string> = {
  red: '#dc2626',
  blue: '#2563eb',
  black: '#1f2937',
  green: '#16a34a',
};

export const COLOR_ORDER: ColorKey[] = ['red', 'blue', 'black', 'green'];

export const WIDTH_PX: Record<WidthKey, number> = {
  thin: 1.4,
  med: 2.4,
  thick: 4.2,
};

export const WIDTH_ORDER: WidthKey[] = ['thin', 'med', 'thick'];

export const PENCIL_ALPHA = 0.55;
