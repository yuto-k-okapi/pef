import type { Point, Stroke } from '../types/drawing';
import type { ScribbleThresholds } from '../store/useSettingsStore';

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
  // REVERSAL_STRIDE_DIST, then compare against the previous accumulated
  // direction. Counts a reversal when the dot product is negative (>90° change).
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

export function analyzeStroke(
  stroke: Stroke,
  thresholds: ScribbleThresholds | null,
): ScribbleMetrics {
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

  const isScribble =
    thresholds !== null &&
    pts.length >= thresholds.minPoints &&
    pathLength >= thresholds.minPathLength &&
    bboxDiagonal >= thresholds.minBboxDiagonal &&
    compactness >= thresholds.minCompactness &&
    reversals >= thresholds.minReversals;

  return {
    points: pts.length,
    pathLength,
    bboxDiagonal,
    compactness,
    reversals,
    isScribble,
  };
}
