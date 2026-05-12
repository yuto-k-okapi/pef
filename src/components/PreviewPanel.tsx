import { useEffect, useRef, useState } from 'react';
import {
  ERASER_SIZE_ORDER,
  ERASER_SIZE_PX,
  PENCIL_ALPHA_VALUE,
  PENCIL_DARKNESS_ORDER,
  scribbleThresholdsFrom,
  useSettingsStore,
  widthValue,
} from '../store/useSettingsStore';
import type { Point, Stroke, Tool, WidthKey } from '../types/drawing';
import { COLORS, WIDTH_ORDER } from '../types/drawing';
import {
  analyzeStroke,
  type ScribbleMetrics,
} from '../lib/scribbleDetector';
import {
  applyLivePenStyle,
  clearCanvas,
  drawCurveSegment,
  drawIncrementalPencilSegment,
  drawLine,
  pointNearStroke,
  renderAllStrokes,
  strokesIntersect,
} from '../lib/strokeRenderer';

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

export function PreviewPanel() {
  const [tool, setTool] = useState<Tool>('pen');
  const [colorIdx, setColorIdx] = useState(0);
  const [widthKey, setWidthKey] = useState<WidthKey>('med');
  const [metrics, setMetrics] = useState<ScribbleMetrics | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const settings = useSettingsStore();

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const sourceRef = useRef<SourceTag>(null);
  const activeTouchIdRef = useRef<number | null>(null);

  // Mutable state snapshot so the long-lived listeners read fresh values.
  const stateRef = useRef({ tool, colorIdx, widthKey, settings });
  stateRef.current = { tool, colorIdx, widthKey, settings };

  function clear() {
    strokesRef.current = [];
    liveStrokeRef.current = null;
    sourceRef.current = null;
    activeTouchIdRef.current = null;
    setMetrics(null);
    setHasContent(false);
    const c = canvasRef.current;
    if (c) clearCanvas(c);
  }

  // Keep the canvas sized to its wrapper
  useEffect(() => {
    const wrap = wrapRef.current;
    const c = canvasRef.current;
    if (!wrap || !c) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      c.style.width = `${rect.width}px`;
      c.style.height = `${rect.height}px`;
      const ctx = c.getContext('2d', { desynchronized: true });
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderAllStrokes(c, strokesRef.current);
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  // Pointer + Touch listeners (attached once)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const pointerToPoint = (e: PointerEvent): Point => {
      const r = c.getBoundingClientRect();
      return {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        pressure: e.pressure > 0 ? e.pressure : 0.5,
      };
    };

    const touchToPoint = (t: IOSTouch): Point => {
      const r = c.getBoundingClientRect();
      return {
        x: t.clientX - r.left,
        y: t.clientY - r.top,
        pressure: t.force > 0 ? t.force : 0.5,
      };
    };

    const eraseAt = (pt: Point) => {
      const { settings } = stateRef.current;
      const r = ERASER_SIZE_PX[settings.eraserSize];
      const next = strokesRef.current.filter(
        (s) => !pointNearStroke(pt.x, pt.y, s, r),
      );
      if (next.length !== strokesRef.current.length) {
        strokesRef.current = next;
        renderAllStrokes(c, strokesRef.current);
      }
    };

    const beginStroke = (pt: Point, source: SourceTag) => {
      const { tool, colorIdx, widthKey, settings } = stateRef.current;
      sourceRef.current = source;
      if (tool === 'eraser') {
        eraseAt(pt);
        liveStrokeRef.current = { points: [pt], color: '__eraser__' };
        return;
      }
      if (tool === 'lasso') return; // lasso not supported in preview
      const color = COLORS[settings.paletteColors[colorIdx]];
      liveStrokeRef.current = {
        points: [pt],
        color,
        kind: tool,
        width: widthValue(widthKey, settings),
        alpha:
          tool === 'pencil' ? PENCIL_ALPHA_VALUE[settings.pencilDarkness] : 1,
      };
      setMetrics(null);
      setHasContent(true);
    };

    const continueStroke = (pt: Point) => {
      const live = liveStrokeRef.current;
      if (!live) return;
      live.points.push(pt);
      const { tool } = stateRef.current;
      if (tool === 'eraser') {
        eraseAt(pt);
        return;
      }
      const ctx = c.getContext('2d');
      if (!ctx) return;
      if (tool === 'pencil') {
        if (live.points.length >= 2) drawIncrementalPencilSegment(ctx, live);
      } else {
        applyLivePenStyle(ctx, live);
        const pts = live.points;
        const n = pts.length;
        if (n === 2) drawLine(ctx, pts[0], pts[1]);
        else if (n >= 3)
          drawCurveSegment(ctx, pts[n - 3], pts[n - 2], pts[n - 1]);
      }
    };

    const finalizeStroke = () => {
      const live = liveStrokeRef.current;
      liveStrokeRef.current = null;
      sourceRef.current = null;
      activeTouchIdRef.current = null;
      if (!live) return;

      const { tool, settings } = stateRef.current;
      if (tool === 'eraser') {
        if (strokesRef.current.length === 0) setHasContent(false);
        return;
      }
      if (tool === 'lasso') return;

      strokesRef.current = [...strokesRef.current, live];
      const m = analyzeStroke(live, scribbleThresholdsFrom(settings));
      setMetrics(m);

      if (m.isScribble) {
        const drop = new Set<number>();
        for (let i = 0; i < strokesRef.current.length - 1; i++) {
          if (strokesIntersect(strokesRef.current[i], live)) drop.add(i);
        }
        drop.add(strokesRef.current.length - 1); // drop the scribble itself
        strokesRef.current = strokesRef.current.filter((_, i) => !drop.has(i));
      }
      renderAllStrokes(c, strokesRef.current);
      if (strokesRef.current.length === 0) setHasContent(false);
    };

    // ---- Pointer Events ----
    const onPointerDown = (e: PointerEvent) => {
      if (liveStrokeRef.current) return; // touch already started
      e.preventDefault();
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      beginStroke(pointerToPoint(e), 'pointer');
    };

    const onPointerMove = (e: PointerEvent) => {
      if (sourceRef.current !== 'pointer') return;
      e.preventDefault();
      const events =
        typeof e.getCoalescedEvents === 'function'
          ? e.getCoalescedEvents()
          : [e];
      for (const ev of events) continueStroke(pointerToPoint(ev));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (sourceRef.current !== 'pointer') return;
      e.preventDefault();
      try {
        if (c.hasPointerCapture(e.pointerId))
          c.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      finalizeStroke();
    };

    // ---- Touch Events (stylus backup on iPadOS) ----
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

    c.addEventListener('pointerdown', onPointerDown);
    c.addEventListener('pointermove', onPointerMove);
    c.addEventListener('pointerup', onPointerUp);
    c.addEventListener('pointercancel', onPointerUp);
    c.addEventListener('touchstart', onTouchStart, { passive: false });
    c.addEventListener('touchmove', onTouchMove, { passive: false });
    c.addEventListener('touchend', onTouchEnd, { passive: false });
    c.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      c.removeEventListener('pointerdown', onPointerDown);
      c.removeEventListener('pointermove', onPointerMove);
      c.removeEventListener('pointerup', onPointerUp);
      c.removeEventListener('pointercancel', onPointerUp);
      c.removeEventListener('touchstart', onTouchStart);
      c.removeEventListener('touchmove', onTouchMove);
      c.removeEventListener('touchend', onTouchEnd);
      c.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // Re-run scribble analysis when thresholds change after a stroke is committed
  useEffect(() => {
    const last = strokesRef.current[strokesRef.current.length - 1];
    if (!last) return;
    setMetrics(analyzeStroke(last, scribbleThresholdsFrom(settings)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.scribbleEnabled,
    settings.scribbleMinReversals,
    settings.scribbleMinCompactness,
  ]);

  const isInk = tool === 'pen' || tool === 'pencil';

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="text-xs font-medium text-gray-500 mb-2">プレビュー</div>

        <div className="flex gap-1.5 mb-1.5">
          <button
            onClick={() => setTool('pen')}
            title="ペン"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${
              tool === 'pen'
                ? 'bg-blue-100 ring-2 ring-blue-500'
                : 'bg-gray-100'
            }`}
          >
            ✒︎
          </button>
          <button
            onClick={() => setTool('pencil')}
            title="鉛筆"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${
              tool === 'pencil'
                ? 'bg-blue-100 ring-2 ring-blue-500'
                : 'bg-gray-100'
            }`}
          >
            ✏︎
          </button>
          <button
            onClick={() => setTool('eraser')}
            title="消しゴム"
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              tool === 'eraser'
                ? 'bg-blue-100 ring-2 ring-blue-500'
                : 'bg-gray-100'
            }`}
          >
            <span
              className="relative inline-block w-5 h-2.5"
              style={{ transform: 'rotate(-18deg)' }}
            >
              <span className="absolute inset-0 bg-pink-300 rounded-sm" />
              <span className="absolute inset-x-0 bottom-0 h-1/3 bg-pink-500 rounded-b-sm" />
            </span>
          </button>
        </div>

        {isInk && (
          <div className="flex gap-1.5 mb-1.5">
            {settings.paletteColors.map((c, idx) => (
              <button
                key={idx}
                onClick={() => setColorIdx(idx)}
                aria-label={`color-${idx}`}
                className={`w-9 h-9 rounded-full ${
                  idx === colorIdx
                    ? 'scale-110 ring-2 ring-offset-2 ring-blue-500'
                    : ''
                }`}
                style={{ backgroundColor: COLORS[c] }}
              />
            ))}
          </div>
        )}

        {isInk && (
          <div className="flex gap-1.5 mb-1.5">
            {WIDTH_ORDER.map((w) => {
              const active = widthKey === w;
              const dot = Math.max(4, widthValue(w, settings) * 2.4);
              return (
                <button
                  key={w}
                  onClick={() => setWidthKey(w)}
                  aria-label={`width-${w}`}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    active
                      ? 'bg-blue-100 ring-2 ring-blue-500'
                      : 'bg-gray-100'
                  }`}
                >
                  <span
                    className="rounded-full bg-gray-700 block"
                    style={{ width: `${dot}px`, height: `${dot}px` }}
                  />
                </button>
              );
            })}
          </div>
        )}

        {tool === 'pencil' && (
          <div className="flex gap-1.5">
            {PENCIL_DARKNESS_ORDER.map((d) => {
              const active = settings.pencilDarkness === d;
              return (
                <button
                  key={d}
                  onClick={() => settings.update({ pencilDarkness: d })}
                  aria-label={`dark-${d}`}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    active
                      ? 'bg-blue-100 ring-2 ring-blue-500'
                      : 'bg-gray-100'
                  }`}
                >
                  <span
                    className="rounded-sm bg-gray-700 block w-4 h-1.5"
                    style={{ opacity: PENCIL_ALPHA_VALUE[d] }}
                  />
                </button>
              );
            })}
          </div>
        )}

        {tool === 'eraser' && (
          <div className="flex gap-1.5">
            {ERASER_SIZE_ORDER.map((sz) => {
              const active = settings.eraserSize === sz;
              const px = ERASER_SIZE_PX[sz];
              return (
                <button
                  key={sz}
                  onClick={() => settings.update({ eraserSize: sz })}
                  aria-label={`size-${sz}`}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    active
                      ? 'bg-blue-100 ring-2 ring-blue-500'
                      : 'bg-gray-100'
                  }`}
                >
                  <span
                    className="rounded-full bg-pink-400 block"
                    style={{ width: `${px * 1.4}px`, height: `${px * 1.4}px` }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        ref={wrapRef}
        className="flex-1 bg-gray-50 relative min-h-0"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ touchAction: 'none' }}
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs pointer-events-none">
            ここで試し書きできます
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-200 text-xs">
        {settings.scribbleEnabled && metrics ? (
          <div className="space-y-0.5 mb-2 font-mono">
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-600">
              <span>n={metrics.points}</span>
              <span>len={metrics.pathLength.toFixed(0)}</span>
              <span>
                comp={metrics.compactness.toFixed(2)}
                <span
                  className={
                    metrics.compactness >= settings.scribbleMinCompactness
                      ? 'text-green-600'
                      : 'text-red-500'
                  }
                >
                  /{settings.scribbleMinCompactness.toFixed(1)}
                </span>
              </span>
              <span>
                rev={metrics.reversals}
                <span
                  className={
                    metrics.reversals >= settings.scribbleMinReversals
                      ? 'text-green-600'
                      : 'text-red-500'
                  }
                >
                  /{settings.scribbleMinReversals}
                </span>
              </span>
            </div>
            <div
              className={`font-bold ${
                metrics.isScribble ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              {metrics.isScribble ? '→ 消去（SCRIBBLE）' : '→ インクとして残る'}
            </div>
          </div>
        ) : (
          <div className="text-gray-400 mb-2 h-8 flex items-center">
            {settings.scribbleEnabled
              ? '書いて判定値を確認'
              : 'ぐちゃぐちゃ消しはオフ'}
          </div>
        )}
        <button
          onClick={clear}
          className="w-full px-3 py-1.5 rounded bg-gray-100 text-xs"
        >
          消去
        </button>
      </div>
    </div>
  );
}
