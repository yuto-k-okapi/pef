import { create } from 'zustand';
import type { Stroke, Tool, ColorKey, WidthKey } from '../types/drawing';
import { setAnnotation } from '../lib/idbStorage';

const UNDO_LIMIT = 30;

interface DrawingState {
  /** PDF currently being edited; null in library mode. */
  activePdfId: string | null;
  tool: Tool;
  color: ColorKey;
  width: WidthKey;
  strokesByPage: Record<number, Stroke[]>;
  undoStackByPage: Record<number, Stroke[][]>;
  /** Increments only when persistent canvas needs a full clear+redraw
   * (remove/undo/page/PDF change). Pen-add does NOT bump this. */
  redrawCounter: number;

  /** Pinch zoom and pan state (relative to the unscaled PDF). */
  zoom: number;
  panX: number;
  panY: number;

  setTool: (tool: Tool) => void;
  setColor: (color: ColorKey) => void;
  setWidth: (width: WidthKey) => void;
  setView: (view: { zoom: number; panX: number; panY: number }) => void;
  resetView: () => void;

  hydrateFromIdb: (
    pdfId: string,
    strokesByPage: Record<number, Stroke[]>,
  ) => void;
  clearActive: () => void;

  addStroke: (page: number, stroke: Stroke) => void;
  removeStrokes: (page: number, indices: number[]) => void;
  /** Translate every stroke at the given indices by (dx, dy). Used by the
   * lasso tool to move a selection. */
  translateStrokes: (
    page: number,
    indices: number[],
    dx: number,
    dy: number,
  ) => void;
  undo: (page: number) => void;
  /** Shift every stroke at pages > `afterPage` up by one slot (used when a
   * new blank page is inserted immediately after the current page). */
  shiftPagesAfter: (afterPage: number) => void;
}

function pushUndo(
  undoStack: Record<number, Stroke[][]>,
  page: number,
  prev: Stroke[],
): Record<number, Stroke[][]> {
  const cur = undoStack[page] ?? [];
  const next = [...cur, prev];
  if (next.length > UNDO_LIMIT) next.shift();
  return { ...undoStack, [page]: next };
}

function persist(pdfId: string | null, page: number, strokes: Stroke[]) {
  if (!pdfId) return;
  void setAnnotation(pdfId, page, strokes);
}

export const useDrawingStore = create<DrawingState>((set) => ({
  activePdfId: null,
  tool: 'pen',
  color: 'red',
  width: 'med',
  strokesByPage: {},
  undoStackByPage: {},
  redrawCounter: 0,
  zoom: 1,
  panX: 0,
  panY: 0,

  setTool: (tool) => set({ tool }),
  setColor: (color) =>
    set((s) => ({ color, tool: s.tool === 'eraser' ? 'pen' : s.tool })),
  setWidth: (width) => set({ width }),
  setView: ({ zoom, panX, panY }) => set({ zoom, panX, panY }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),

  hydrateFromIdb: (pdfId, strokesByPage) =>
    set((s) => ({
      activePdfId: pdfId,
      strokesByPage,
      undoStackByPage: {},
      redrawCounter: s.redrawCounter + 1,
      zoom: 1,
      panX: 0,
      panY: 0,
    })),

  clearActive: () =>
    set((s) => ({
      activePdfId: null,
      strokesByPage: {},
      undoStackByPage: {},
      redrawCounter: s.redrawCounter + 1,
      zoom: 1,
      panX: 0,
      panY: 0,
    })),

  addStroke: (page, stroke) =>
    set((s) => {
      const cur = s.strokesByPage[page] ?? [];
      const next = [...cur, stroke];
      persist(s.activePdfId, page, next);
      return {
        strokesByPage: { ...s.strokesByPage, [page]: next },
        undoStackByPage: pushUndo(s.undoStackByPage, page, cur),
      };
    }),

  removeStrokes: (page, indices) =>
    set((s) => {
      if (indices.length === 0) return s;
      const cur = s.strokesByPage[page] ?? [];
      const idx = new Set(indices);
      const next = cur.filter((_, i) => !idx.has(i));
      if (next.length === cur.length) return s;
      persist(s.activePdfId, page, next);
      return {
        strokesByPage: { ...s.strokesByPage, [page]: next },
        undoStackByPage: pushUndo(s.undoStackByPage, page, cur),
        redrawCounter: s.redrawCounter + 1,
      };
    }),

  translateStrokes: (page, indices, dx, dy) =>
    set((s) => {
      if (indices.length === 0 || (dx === 0 && dy === 0)) return s;
      const cur = s.strokesByPage[page] ?? [];
      const idxSet = new Set(indices);
      const next = cur.map((stroke, i) => {
        if (!idxSet.has(i)) return stroke;
        return {
          ...stroke,
          points: stroke.points.map((p) => ({
            x: p.x + dx,
            y: p.y + dy,
            pressure: p.pressure,
          })),
        };
      });
      persist(s.activePdfId, page, next);
      return {
        strokesByPage: { ...s.strokesByPage, [page]: next },
        undoStackByPage: pushUndo(s.undoStackByPage, page, cur),
        redrawCounter: s.redrawCounter + 1,
      };
    }),

  shiftPagesAfter: (afterPage) =>
    set((s) => {
      const nextStrokes: Record<number, Stroke[]> = {};
      for (const [k, v] of Object.entries(s.strokesByPage)) {
        const pk = Number(k);
        nextStrokes[pk > afterPage ? pk + 1 : pk] = v;
      }
      const nextUndo: Record<number, Stroke[][]> = {};
      for (const [k, v] of Object.entries(s.undoStackByPage)) {
        const pk = Number(k);
        nextUndo[pk > afterPage ? pk + 1 : pk] = v;
      }
      return {
        strokesByPage: nextStrokes,
        undoStackByPage: nextUndo,
        redrawCounter: s.redrawCounter + 1,
      };
    }),

  undo: (page) =>
    set((s) => {
      const undoCur = s.undoStackByPage[page] ?? [];
      if (undoCur.length === 0) return s;
      const prev = undoCur[undoCur.length - 1];
      persist(s.activePdfId, page, prev);
      return {
        strokesByPage: { ...s.strokesByPage, [page]: prev },
        undoStackByPage: { ...s.undoStackByPage, [page]: undoCur.slice(0, -1) },
        redrawCounter: s.redrawCounter + 1,
      };
    }),
}));
