import { useEffect, useRef, useState } from 'react';
import {
  scribbleThresholdsFrom,
  useSettingsStore,
} from '../store/useSettingsStore';
import type { Point, Stroke } from '../types/drawing';
import { analyzeStroke } from '../lib/scribbleDetector';
import { renderStroke } from '../lib/strokeRenderer';

/**
 * Interactive scribble-detection tester. The user can draw with finger or
 * pen and see live metrics + the verdict at the current threshold settings.
 */
export function ScribblePreview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const [metrics, setMetrics] = useState<{
    points: number;
    pathLength: number;
    bboxDiagonal: number;
    compactness: number;
    reversals: number;
    isScribble: boolean;
  } | null>(null);
  const settings = useSettingsStore();
  const thresholds = scribbleThresholdsFrom(settings);

  // Re-analyse when thresholds change after a stroke has been drawn
  useEffect(() => {
    if (!liveStrokeRef.current && metrics === null) return;
    const stroke = liveStrokeRef.current;
    if (stroke) setMetrics(analyzeStroke(stroke, thresholds));
    // metrics intentionally omitted so we only re-run when thresholds change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.scribbleEnabled,
    settings.scribbleMinReversals,
    settings.scribbleMinCompactness,
  ]);

  function getPoint(e: PointerEvent): Point {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  function drawAll() {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (liveStrokeRef.current) renderStroke(ctx, liveStrokeRef.current);
  }

  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    c.style.width = `${rect.width}px`;
    c.style.height = `${rect.height}px`;
    c.getContext('2d', { desynchronized: true })?.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0,
    );

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      liveStrokeRef.current = {
        points: [getPoint(e)],
        color: '#1f2937',
        kind: 'pen',
        width: 2.4,
        alpha: 1,
      };
      setMetrics(null);
      drawAll();
    };
    const onMove = (e: PointerEvent) => {
      const live = liveStrokeRef.current;
      if (!live) return;
      e.preventDefault();
      const events =
        typeof e.getCoalescedEvents === 'function'
          ? e.getCoalescedEvents()
          : [e];
      for (const ev of events) live.points.push(getPoint(ev));
      drawAll();
    };
    const onUp = (e: PointerEvent) => {
      const live = liveStrokeRef.current;
      if (!live) return;
      e.preventDefault();
      setMetrics(analyzeStroke(live, thresholds));
      try {
        c.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    return () => {
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    liveStrokeRef.current = null;
    setMetrics(null);
    drawAll();
  }

  const wouldErase = thresholds !== null && metrics?.isScribble;

  return (
    <div>
      <div
        ref={wrapRef}
        className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-lg relative"
        style={{ height: '160px', touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ touchAction: 'none' }}
        />
        {metrics === null && !liveStrokeRef.current && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none">
            ここでぐちゃぐちゃ書いて試せます
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={clear}
          className="px-3 py-1 rounded bg-gray-100 text-xs"
        >
          消去
        </button>
        {metrics ? (
          <div className="flex-1 text-xs font-mono">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600">
              <span>n={metrics.points}</span>
              <span>len={metrics.pathLength.toFixed(0)}</span>
              <span>bbox={metrics.bboxDiagonal.toFixed(0)}</span>
              <span>
                comp={metrics.compactness.toFixed(2)}
                {thresholds && (
                  <span
                    className={
                      metrics.compactness >= thresholds.minCompactness
                        ? 'text-green-600'
                        : 'text-red-500'
                    }
                  >
                    /{thresholds.minCompactness.toFixed(1)}
                  </span>
                )}
              </span>
              <span>
                rev={metrics.reversals}
                {thresholds && (
                  <span
                    className={
                      metrics.reversals >= thresholds.minReversals
                        ? 'text-green-600'
                        : 'text-red-500'
                    }
                  >
                    /{thresholds.minReversals}
                  </span>
                )}
              </span>
            </div>
            <div
              className={`mt-1 font-bold ${
                wouldErase ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              判定: {wouldErase ? '消去（SCRIBBLE）' : 'インクとして残る'}
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-400">描いてみてください</span>
        )}
      </div>
    </div>
  );
}
