import type { Stroke } from '../types/drawing';

const MIN_POINTS = 6;
const MIN_PATH_LENGTH = 60;
const MIN_BBOX_DIAGONAL = 20;
const MIN_COMPACTNESS = 1.8;
const MIN_REVERSALS = 3;
const REVERSAL_STRIDE = 3;

export interface ScribbleMetrics {
  points: number;
  pathLength: number;
  bboxDiagonal: number;
  compactness: number;
  reversals: number;
  isScribble: boolean;
}

export function analyzeStroke(stroke: Stroke): ScribbleMetrics {
  const pts = stroke.points;
  let pathLength = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      pathLength += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    }
  }

  const bboxDiagonal = pts.length > 0 ? Math.hypot(maxX - minX, maxY - minY) : 0;
  const compactness = bboxDiagonal > 0 ? pathLength / bboxDiagonal : 0;

  // Direction reversals across STRIDE-sized windows (robust to per-sample jitter)
  let reversals = 0;
  let prevDx = 0;
  let prevDy = 0;
  let prevSet = false;
  for (let i = REVERSAL_STRIDE; i < pts.length; i += REVERSAL_STRIDE) {
    const dx = pts[i].x - pts[i - REVERSAL_STRIDE].x;
    const dy = pts[i].y - pts[i - REVERSAL_STRIDE].y;
    if (prevSet) {
      const dot = dx * prevDx + dy * prevDy;
      if (dot < 0) reversals++;
    }
    prevDx = dx;
    prevDy = dy;
    prevSet = true;
  }

  const ok =
    pts.length >= MIN_POINTS &&
    pathLength >= MIN_PATH_LENGTH &&
    bboxDiagonal >= MIN_BBOX_DIAGONAL &&
    compactness >= MIN_COMPACTNESS &&
    reversals >= MIN_REVERSALS;

  return {
    points: pts.length,
    pathLength,
    bboxDiagonal,
    compactness,
    reversals,
    isScribble: ok,
  };
}

export function isScribble(stroke: Stroke): boolean {
  return analyzeStroke(stroke).isScribble;
}
