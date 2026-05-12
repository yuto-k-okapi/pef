import type { Point, Stroke } from '../types/drawing';

const DEFAULT_WIDTH = 2.4;
// Pencil texture density: dots per CSS pixel along the path.
const PENCIL_DOT_DENSITY = 1.6;
const PENCIL_DOT_RADIUS_RATIO = 0.32;
const PENCIL_DOT_ALPHA_MIN = 0.18;
const PENCIL_DOT_ALPHA_RANGE = 0.42;
const PENCIL_JITTER_RATIO = 0.95;
const DEFAULT_PENCIL_ALPHA = 0.55;

function strokeWidth(stroke: Stroke): number {
  return stroke.width ?? DEFAULT_WIDTH;
}

function strokeAlpha(stroke: Stroke): number {
  if (stroke.alpha !== undefined) return stroke.alpha;
  return stroke.kind === 'pencil' ? DEFAULT_PENCIL_ALPHA : 1;
}

function midpoint(a: Point, b: Point): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Deterministic pseudo-random so re-rendering produces the same texture.
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawPencilSegment(
  ctx: CanvasRenderingContext2D,
  p0: Point,
  p1: Point,
  w: number,
  seedBase: number,
  alphaMult: number,
) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const nx = -dy / len; // perpendicular unit vector
  const ny = dx / len;
  const dotCount = Math.max(2, Math.ceil(len * PENCIL_DOT_DENSITY));
  const radius = w * PENCIL_DOT_RADIUS_RATIO;

  for (let i = 0; i < dotCount; i++) {
    const t = (i + 0.5) / dotCount;
    const seed = seedBase * 1024 + i;
    const jitter = (hash(seed) - 0.5) * w * PENCIL_JITTER_RATIO;
    const alpha =
      (PENCIL_DOT_ALPHA_MIN + hash(seed + 0.5) * PENCIL_DOT_ALPHA_RANGE) *
      alphaMult;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(
      p0.x + dx * t + nx * jitter,
      p0.y + dy * t + ny * jitter,
      radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
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

  if (stroke.kind === 'pencil') {
    ctx.save();
    ctx.fillStyle = stroke.color;
    const w = strokeWidth(stroke);
    const a = strokeAlpha(stroke) / DEFAULT_PENCIL_ALPHA; // 1.0 at default
    if (pts.length === 1) {
      drawPencilSegment(ctx, pts[0], pts[0], w, 0, a);
    } else {
      for (let i = 1; i < pts.length; i++) {
        drawPencilSegment(ctx, pts[i - 1], pts[i], w, i, a);
      }
    }
    ctx.restore();
    return;
  }

  // Pen
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeWidth(stroke);
  ctx.globalAlpha = 1;

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

/** Configure a 2D context for live-drawing the given pen stroke (pencil
 * uses its own incremental renderer — see drawIncrementalPencilSegment). */
export function applyLivePenStyle(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
) {
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeWidth(stroke);
  ctx.globalAlpha = 1;
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

export function drawIncrementalPencilSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
) {
  const pts = stroke.points;
  if (pts.length < 2) return;
  ctx.save();
  ctx.fillStyle = stroke.color;
  drawPencilSegment(
    ctx,
    pts[pts.length - 2],
    pts[pts.length - 1],
    strokeWidth(stroke),
    pts.length - 1,
    strokeAlpha(stroke) / DEFAULT_PENCIL_ALPHA,
  );
  ctx.restore();
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

export function pointInPolygon(
  px: number,
  py: number,
  polygon: Point[],
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function strokeIntersectsPolygon(
  stroke: Stroke,
  polygon: Point[],
): boolean {
  if (polygon.length < 3) return false;
  for (const p of stroke.points) {
    if (pointInPolygon(p.x, p.y, polygon)) return true;
  }
  return false;
}
