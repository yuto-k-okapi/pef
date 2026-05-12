import { create } from 'zustand';
import type { Stroke, Tool, ColorKey } from '../types/drawing';
import { setAnnotation } from '../lib/idbStorage';

const UNDO_LIMIT = 30;

interface DrawingState {
  /** PDF currently being edited; null in library mode. */
  activePdfId: string | null;
  tool: Tool;
  color: ColorKey;
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
  setView: (view: { zoom: number; panX: number; panY: number }) => void;
  resetView: () => void;

  hydrateFromIdb: (
    pdfId: string,
    strokesByPage: Record<number, Stroke[]>,
  ) => void;
  clearActive: () => void;

  addStroke: (page: number, stroke: Stroke) => void;
  removeStrokes: (page: number, indices: number[]) => void;
  undo: (page: number) => void;
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
  strokesByPage: {},
  undoStackByPage: {},
  redrawCounter: 0,
  zoom: 1,
  panX: 0,
  panY: 0,

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color, tool: 'pen' }),
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
