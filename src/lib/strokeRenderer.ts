import type { Point, Stroke } from '../types/drawing';

const MIN_WIDTH = 1.6;
const MAX_WIDTH = 4.4;

export function widthFromPressure(pressure: number): number {
  const p = Math.max(0, Math.min(1, pressure));
  return MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * p;
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

  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (pts.length === 1) {
    const p = pts[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, widthFromPressure(p.pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (pts.length === 2) {
    drawLine(ctx, pts[0], pts[1]);
    return;
  }

  // First half-segment: from pts[0] to midpoint(pts[0], pts[1])
  const m01 = midpoint(pts[0], pts[1]);
  ctx.lineWidth = widthFromPressure(pts[0].pressure);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(m01.x, m01.y);
  ctx.stroke();

  // Middle: quadratic curves through each interior point, midpoint to midpoint
  for (let i = 1; i < pts.length - 1; i++) {
    drawCurveSegment(ctx, pts[i - 1], pts[i], pts[i + 1]);
  }

  // Last half-segment: from midpoint(pts[n-2], pts[n-1]) to pts[n-1]
  const last = pts[pts.length - 1];
  const beforeLast = pts[pts.length - 2];
  const mLast = midpoint(beforeLast, last);
  ctx.lineWidth = widthFromPressure(last.pressure);
  ctx.beginPath();
  ctx.moveTo(mLast.x, mLast.y);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

export function drawLine(ctx: CanvasRenderingContext2D, p0: Point, p1: Point) {
  ctx.lineWidth = widthFromPressure((p0.pressure + p1.pressure) / 2);
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
  ctx.lineWidth = widthFromPressure(cur.pressure);
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
