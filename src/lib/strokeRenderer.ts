import type { Point, Stroke } from '../types/drawing';
import { PENCIL_ALPHA } from '../types/drawing';

const DEFAULT_WIDTH = 2.4;

function strokeWidth(stroke: Stroke): number {
  return stroke.width ?? DEFAULT_WIDTH;
}

function strokeAlpha(stroke: Stroke): number {
  return stroke.kind === 'pencil' ? PENCIL_ALPHA : 1;
}

function midpoint(a: Point, b: Point): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function clearCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeWidth(stroke);
  ctx.globalAlpha = strokeAlpha(stroke);

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (pts.length === 2) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Single continuous path through midpoints (smooth at all sample rates)
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const m = midpoint(pts[i], pts[i + 1]);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

/** Configure a 2D context for live-drawing the given stroke. */
export function applyLiveStrokeStyle(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
) {
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeWidth(stroke);
  ctx.globalAlpha = strokeAlpha(stroke);
}

export function drawLine(ctx: CanvasRenderingContext2D, p0: Point, p1: Point) {
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
}

export function drawCurveSegment(
  ctx: CanvasRenderingContext2D,
  prev: Point,
  cur: Point,
  next: Point,
) {
  const m1 = midpoint(prev, cur);
  const m2 = midpoint(cur, next);
  ctx.beginPath();
  ctx.moveTo(m1.x, m1.y);
  ctx.quadraticCurveTo(cur.x, cur.y, m2.x, m2.y);
  ctx.stroke();
}

export function renderAllStrokes(canvas: HTMLCanvasElement, strokes: Stroke[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  clearCanvas(canvas);
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const stroke of strokes) renderStroke(ctx, stroke);
}

export function strokesIntersect(a: Stroke, b: Stroke, threshold = 10): boolean {
  const t2 = threshold * threshold;
  for (const pa of a.points) {
    for (const pb of b.points) {
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      if (dx * dx + dy * dy < t2) return true;
    }
  }
  return false;
}

export function pointNearStroke(
  px: number,
  py: number,
  stroke: Stroke,
  threshold = 12,
): boolean {
  const t2 = threshold * threshold;
  for (const p of stroke.points) {
    const dx = p.x - px;
    const dy = p.y - py;
    if (dx * dx + dy * dy < t2) return true;
  }
  return false;
}
