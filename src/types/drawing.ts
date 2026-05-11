export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  points: Point[];
  color: string;
}

export type Tool = 'pen' | 'eraser';
export type ColorKey = 'red' | 'blue' | 'black' | 'green';

export const COLORS: Record<ColorKey, string> = {
  red: '#dc2626',
  blue: '#2563eb',
  black: '#1f2937',
  green: '#16a34a',
};

export const COLOR_ORDER: ColorKey[] = ['red', 'blue', 'black', 'green'];
