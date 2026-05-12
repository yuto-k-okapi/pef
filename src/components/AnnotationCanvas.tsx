import { useEffect, useRef } from 'react';
import { useDrawingStore } from '../store/useDrawingStore';
import { COLORS, WIDTH_PX } from '../types/drawing';
import type { Point, Stroke } from '../types/drawing';
import {
  applyLivePenStyle,
  clearCanvas,
  drawCurveSegment,
  drawIncrementalPencilSegment,
  drawLine,
  pointNearStroke,
  renderAllStrokes,
  renderStroke,
  strokesIntersect,
} from '../lib/strokeRenderer';
import { analyzeStroke } from '../lib/scribbleDetector';
import { useLogStore } from '../lib/diagnostics';

interface Props {
  page: number;
  cssWidth: number;
  cssHeight: number;
}

const EMPTY: Stroke[] = [];
const ERASER_RADIUS = 5;

type SourceTag = 'pointer' | 'touch' | null;

interface IOSTouch extends Touch {
  touchType?: 'direct' | 'stylus';
}

function findStylus(list: TouchList): IOSTouch | null {
  for (let i = 0; i < list.length; i++) {
    const t = list[i] as IOSTouch;
    if (t.touchType === 'stylus') return t;
  }
  return null;
}

function findTouchById(list: TouchList, id: number): IOSTouch | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].identifier === id) return list[i] as IOSTouch;
  }
  return null;
}

interface PinchState {
  initialDist: number;
  initialMid: { x: number; y: number };
  initialZoom: number;
  initialPan: { x: number; y: number };
}

export function AnnotationCanvas({ page, cssWidth, cssHeight }: Props) {
  const persistentRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const sourceRef = useRef<SourceTag>(null);
  const activeTouchIdRef = useRef<number | null>(null);
  const fingersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<PinchState | null>(null);
  const redrawCounter = useDrawingStore((s) => s.redrawCounter);

  // Resize both canvases when dimensions change, applying DPR transform
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    for (const ref of [persistentRef, liveRef]) {
      const c = ref.current;
      if (!c) continue;
      c.width = Math.floor(cssWidth * dpr);
      c.height = Math.floor(cssHeight * dpr);
      c.style.width = `${cssWidth}px`;
      c.style.height = `${cssHeight}px`;
      // desynchronized: true requests low-latency mode in Safari/Chrome,
      // reducing apparent input-to-paint lag for the pen.
      const ctx = c.getContext('2d', { desynchronized: true });
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (persistentRef.current) {
      const cur = useDrawingStore.getState().strokesByPage[page] ?? EMPTY;
      renderAllStrokes(persistentRef.current, cur);
    }
  }, [cssWidth, cssHeight, page]);

  // Re-render persistent canvas only when a full redraw is requested
  // (remove/undo/page change). Pen-add does NOT trigger this.
  useEffect(() => {
    if (persistentRef.current) {
      const cur = useDrawingStore.getState().strokesByPage[page] ?? EMPTY;
      renderAllStrokes(persistentRef.current, cur);
    }
  }, [redrawCounter, page]);

  // Drawing event listeners (Pointer + Touch). Touch events are used as a
  // backup for iPadOS where pointer events for the 2nd Apple Pencil stroke
  // sometimes fail to fire. Whichever event source starts the stroke first
  // owns it (sourceRef) and the other source ignores subsequent events.
  useEffect(() => {
    const live = liveRef.current;
    if (!live) return;

    // ---- shared helpers ----
    const eraseAt = (pt: Point) => {
      const cur = useDrawingStore.getState().strokesByPage[page] ?? EMPTY;
      const indices: number[] = [];
      for (let i = 0; i < cur.length; i++) {
        if (pointNearStroke(pt.x, pt.y, cur[i], ERASER_RADIUS)) indices.push(i);
      }
      if (indices.length > 0) {
        useDrawingStore.getState().removeStrokes(page, indices);
      }
    };

    const drawEraserCursor = (pt: Point) => {
      clearCanvas(live);
      const ctx = live.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, ERASER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    const drawIncremental = (stroke: Stroke) => {
      const ctx = live.getContext('2d');
      if (!ctx) return;
      if (stroke.kind === 'pencil') {
        drawIncrementalPencilSegment(ctx, stroke);
        return;
      }
      applyLivePenStyle(ctx, stroke);
      const pts = stroke.points;
      const n = pts.length;
      if (n === 2) {
        drawLine(ctx, pts[0], pts[1]);
      } else if (n >= 3) {
        drawCurveSegment(ctx, pts[n - 3], pts[n - 2], pts[n - 1]);
      }
    };

    const beginStroke = (pt: Point, source: SourceTag) => {
      const { tool, color, width } = useDrawingStore.getState();
      sourceRef.current = source;
      if (tool === 'eraser') {
        liveStrokeRef.current = {
          points: [pt],
          color: '__eraser__',
        };
        eraseAt(pt);
        drawEraserCursor(pt);
      } else {
        liveStrokeRef.current = {
          points: [pt],
          color: COLORS[color],
          kind: tool, // 'pen' or 'pencil'
          width: WIDTH_PX[width],
        };
      }
    };

    const continueStroke = (pt: Point) => {
      const liveStroke = liveStrokeRef.current;
      if (!liveStroke) return;
      liveStroke.points.push(pt);
      const tool = useDrawingStore.getState().tool;
      if (tool === 'eraser') {
        eraseAt(pt);
        drawEraserCursor(pt);
      } else {
        drawIncremental(liveStroke);
      }
    };

    const finalizeStroke = () => {
      const liveStroke = liveStrokeRef.current;
      liveStrokeRef.current = null;
      sourceRef.current = null;
      activeTouchIdRef.current = null;
      if (!liveStroke) return;

      const tool = useDrawingStore.getState().tool;
      if (tool === 'eraser') {
        clearCanvas(live);
        return;
      }

      // pen / pencil
      const m = analyzeStroke(liveStroke);
      useLogStore
        .getState()
        .add(
          'warn',
          `stroke n=${m.points} len=${m.pathLength.toFixed(0)} bbox=${m.bboxDiagonal.toFixed(0)} comp=${m.compactness.toFixed(2)} rev=${m.reversals} → ${m.isScribble ? 'SCRIBBLE' : 'ink'}`,
        );

      if (m.isScribble) {
        const cur = useDrawingStore.getState().strokesByPage[page] ?? EMPTY;
        const indices: number[] = [];
        for (let i = 0; i < cur.length; i++) {
          if (strokesIntersect(cur[i], liveStroke)) indices.push(i);
        }
        clearCanvas(live);
        if (indices.length > 0) {
          useDrawingStore.getState().removeStrokes(page, indices);
        }
        return;
      }

      // Paint to persistent first to avoid flash, then clear live.
      if (persistentRef.current) {
        const ctx = persistentRef.current.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderStroke(ctx, liveStroke);
        }
      }
      clearCanvas(live);
      useDrawingStore.getState().addStroke(page, liveStroke);
    };

    // ---- Pointer Events (mouse + most pens, hover support) ----
    const pointerToPoint = (e: PointerEvent): Point => {
      const rect = live.getBoundingClientRect();
      // rect is the visually-scaled rect; divide by zoom to get unscaled canvas coords
      const zoom = useDrawingStore.getState().zoom;
      return {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
        pressure: e.pressure > 0 ? e.pressure : 0.5,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return;
      if (liveStrokeRef.current) return; // touch already started
      try {
        live.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      beginStroke(pointerToPoint(e), 'pointer');
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return;
      if (sourceRef.current === 'pointer') {
        // Browsers coalesce rapid pointer events into one. getCoalescedEvents()
        // gives us every intermediate sample so high-rate Pencils don't get
        // down-sampled to display refresh rate → much smoother lines.
        const events =
          typeof e.getCoalescedEvents === 'function'
            ? e.getCoalescedEvents()
            : [e];
        for (const ev of events) {
          continueStroke(pointerToPoint(ev));
        }
      } else if (sourceRef.current === null) {
        // Hover: show eraser cursor only
        if (useDrawingStore.getState().tool === 'eraser') {
          drawEraserCursor(pointerToPoint(e));
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return;
      if (sourceRef.current !== 'pointer') return;
      try {
        if (live.hasPointerCapture(e.pointerId)) {
          live.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      finalizeStroke();
    };

    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return;
      if (!liveStrokeRef.current) {
        clearCanvas(live);
      }
    };

    // ---- Touch Events (iPad Apple Pencil + 2-finger pinch/pan) ----
    const touchToPoint = (t: IOSTouch): Point => {
      const rect = live.getBoundingClientRect();
      const zoom = useDrawingStore.getState().zoom;
      return {
        x: (t.clientX - rect.left) / zoom,
        y: (t.clientY - rect.top) / zoom,
        pressure: t.force > 0 ? t.force : 0.5,
      };
    };

    const trackFingers = (e: TouchEvent) => {
      // Update positions of all currently-active non-stylus touches
      fingersRef.current.clear();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i] as IOSTouch;
        if (t.touchType === 'stylus') continue;
        fingersRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    };

    const beginPinch = () => {
      if (fingersRef.current.size < 2) return;
      const [a, b] = Array.from(fingersRef.current.values());
      const { zoom, panX, panY } = useDrawingStore.getState();
      pinchRef.current = {
        initialDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        initialMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        initialZoom: zoom,
        initialPan: { x: panX, y: panY },
      };
    };

    const updatePinch = () => {
      const p = pinchRef.current;
      if (!p || fingersRef.current.size < 2) return;
      const [a, b] = Array.from(fingersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = dist / p.initialDist;
      const newZoom = Math.max(1, Math.min(5, p.initialZoom * factor));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dx = mid.x - p.initialMid.x;
      const dy = mid.y - p.initialMid.y;
      useDrawingStore.getState().setView({
        zoom: newZoom,
        // At zoom = 1 the page fits; force pan back to origin so it can't
        // drift off-screen via accumulated translate.
        panX: newZoom === 1 ? 0 : p.initialPan.x + dx,
        panY: newZoom === 1 ? 0 : p.initialPan.y + dy,
      });
    };

    const onTouchStart = (e: TouchEvent) => {
      const stylus = findStylus(e.changedTouches);
      if (stylus) {
        e.preventDefault();
        if (liveStrokeRef.current) return; // pointer already started
        activeTouchIdRef.current = stylus.identifier;
        beginStroke(touchToPoint(stylus), 'touch');
        return;
      }
      // Non-stylus touches: track for pinch/pan
      trackFingers(e);
      if (fingersRef.current.size >= 2 && !liveStrokeRef.current) {
        e.preventDefault();
        beginPinch();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (sourceRef.current === 'touch') {
        const id = activeTouchIdRef.current;
        if (id === null) return;
        const t = findTouchById(e.changedTouches, id);
        if (!t) return;
        e.preventDefault();
        continueStroke(touchToPoint(t));
        return;
      }
      if (pinchRef.current && fingersRef.current.size >= 2) {
        // Update tracked finger positions
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i] as IOSTouch;
          if (t.touchType === 'stylus') continue;
          if (fingersRef.current.has(t.identifier)) {
            fingersRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
          }
        }
        e.preventDefault();
        updatePinch();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (sourceRef.current === 'touch') {
        const id = activeTouchIdRef.current;
        if (id === null) return;
        const t = findTouchById(e.changedTouches, id);
        if (!t) return;
        e.preventDefault();
        finalizeStroke();
        return;
      }
      // Remove ended fingers from tracking
      for (let i = 0; i < e.changedTouches.length; i++) {
        fingersRef.current.delete(e.changedTouches[i].identifier);
      }
      if (fingersRef.current.size < 2) {
        pinchRef.current = null;
      }
    };

    // ---- attach ----
    live.addEventListener('pointerdown', onPointerDown);
    live.addEventListener('pointermove', onPointerMove);
    live.addEventListener('pointerup', onPointerUp);
    live.addEventListener('pointercancel', onPointerUp);
    live.addEventListener('pointerleave', onPointerLeave);
    live.addEventListener('touchstart', onTouchStart, { passive: false });
    live.addEventListener('touchmove', onTouchMove, { passive: false });
    live.addEventListener('touchend', onTouchEnd, { passive: false });
    live.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      live.removeEventListener('pointerdown', onPointerDown);
      live.removeEventListener('pointermove', onPointerMove);
      live.removeEventListener('pointerup', onPointerUp);
      live.removeEventListener('pointercancel', onPointerUp);
      live.removeEventListener('pointerleave', onPointerLeave);
      live.removeEventListener('touchstart', onTouchStart);
      live.removeEventListener('touchmove', onTouchMove);
      live.removeEventListener('touchend', onTouchEnd);
      live.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [page]);

  return (
    <>
      <canvas
        ref={persistentRef}
        className="absolute inset-0 pointer-events-none select-none"
      />
      <canvas
        ref={liveRef}
        className="absolute inset-0 select-none"
        style={{ touchAction: 'none' }}
      />
    </>
  );
}
