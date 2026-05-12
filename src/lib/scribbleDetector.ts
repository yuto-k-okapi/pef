import type { Point, Stroke } from '../types/drawing';

// Tuned from real-stroke metrics: a normal complex character (n=69) had
// rev=9 and compactness in the ~2 range. We raise both bars so only clearly
// scribbled gestures trigger — a real 「ぐちゃぐちゃ」 has rev≥12 and
// compactness≥3.5.
const MIN_POINTS = 12;
const MIN_PATH_LENGTH = 120;
const MIN_BBOX_DIAGONAL = 30;
const MIN_COMPACTNESS = 3.5;
const MIN_REVERSALS = 12;
const REVERSAL_STRIDE_DIST = 6;

export interface ScribbleMetrics {
  points: number;
  pathLength: number;
  bboxDiagonal: number;
  compactness: number;
  reversals: number;
  isScribble: boolean;
}

function countDistanceBasedReversals(pts: Point[]): number {
  // Sample-rate independent: accumulate displacement until it covers
  // REVERSAL_STRIDE_DIST, then compare its direction against the previous
  // accumulated segment. Counts a reversal when dot product is negative.
  let reversals = 0;
  let lastVx = 0;
  let lastVy = 0;
  let lastSet = false;
  let accVx = 0;
  let accVy = 0;
  const strideSq = REVERSAL_STRIDE_DIST * REVERSAL_STRIDE_DIST;

  for (let i = 1; i < pts.length; i++) {
    accVx += pts[i].x - pts[i - 1].x;
    accVy += pts[i].y - pts[i - 1].y;
    if (accVx * accVx + accVy * accVy < strideSq) continue;

    if (lastSet) {
      const dot = accVx * lastVx + accVy * lastVy;
      if (dot < 0) reversals++;
    }
    lastVx = accVx;
    lastVy = accVy;
    lastSet = true;
    accVx = 0;
    accVy = 0;
  }
  return reversals;
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
  const reversals = countDistanceBasedReversals(pts);

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
