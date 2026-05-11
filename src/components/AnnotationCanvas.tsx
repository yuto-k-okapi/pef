import { useEffect, useRef } from 'react';
import { useDrawingStore } from '../store/useDrawingStore';
import { COLORS } from '../types/drawing';
import type { Point, Stroke } from '../types/drawing';
import {
  clearCanvas,
  drawCurveSegment,
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

export function AnnotationCanvas({ page, cssWidth, cssHeight }: Props) {
  const persistentRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const sourceRef = useRef<SourceTag>(null);
  const activeTouchIdRef = useRef<number | null>(null);
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
      c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    const drawIncremental = (color: string, pts: Point[]) => {
      const ctx = live.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const n = pts.length;
      if (n === 2) {
        drawLine(ctx, pts[0], pts[1]);
      } else if (n >= 3) {
        drawCurveSegment(ctx, pts[n - 3], pts[n - 2], pts[n - 1]);
      }
    };

    const beginStroke = (pt: Point, source: SourceTag) => {
      const { tool, color } = useDrawingStore.getState();
      sourceRef.current = source;
      liveStrokeRef.current = {
        points: [pt],
        color: tool === 'pen' ? COLORS[color] : '__eraser__',
      };
      if (tool === 'eraser') {
        eraseAt(pt);
        drawEraserCursor(pt);
      }
    };

    const continueStroke = (pt: Point) => {
      const liveStroke = liveStrokeRef.current;
      if (!liveStroke) return;
      liveStroke.points.push(pt);
      const tool = useDrawingStore.getState().tool;
      if (tool === 'pen') {
        drawIncremental(liveStroke.color, liveStroke.points);
      } else if (tool === 'eraser') {
        eraseAt(pt);
        drawEraserCursor(pt);
      }
    };

    const finalizeStroke = () => {
      const liveStroke = liveStrokeRef.current;
      liveStrokeRef.current = null;
      sourceRef.current = null;
      activeTouchIdRef.current = null;
      if (!liveStroke) return;

      const tool = useDrawingStore.getState().tool;
      if (tool === 'pen') {
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
      } else {
        clearCanvas(live);
      }
    };

    // ---- Pointer Events (mouse + most pens, hover support) ----
    const pointerToPoint = (e: PointerEvent): Point => {
      const rect = live.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
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
        continueStroke(pointerToPoint(e));
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

    // ---- Touch Events (iPad Apple Pencil reliable backup) ----
    const touchToPoint = (t: IOSTouch): Point => {
      const rect = live.getBoundingClientRect();
      return {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
        pressure: t.force > 0 ? t.force : 0.5,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      const stylus = findStylus(e.changedTouches);
      if (!stylus) return;
      e.preventDefault();
      if (liveStrokeRef.current) return; // pointer already started
      activeTouchIdRef.current = stylus.identifier;
      beginStroke(touchToPoint(stylus), 'touch');
    };

    const onTouchMove = (e: TouchEvent) => {
      if (sourceRef.current !== 'touch') return;
      const id = activeTouchIdRef.current;
      if (id === null) return;
      const t = findTouchById(e.changedTouches, id);
      if (!t) return;
      e.preventDefault();
      continueStroke(touchToPoint(t));
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (sourceRef.current !== 'touch') return;
      const id = activeTouchIdRef.current;
      if (id === null) return;
      const t = findTouchById(e.changedTouches, id);
      if (!t) return;
      e.preventDefault();
      finalizeStroke();
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
