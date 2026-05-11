import { useDrawingStore } from '../store/useDrawingStore';
import { COLORS, COLOR_ORDER } from '../types/drawing';

export function Toolbar({ page }: { page: number }) {
  const tool = useDrawingStore((s) => s.tool);
  const color = useDrawingStore((s) => s.color);
  const setTool = useDrawingStore((s) => s.setTool);
  const setColor = useDrawingStore((s) => s.setColor);
  const undo = useDrawingStore((s) => s.undo);
  const undoDepth = useDrawingStore((s) => s.undoStackByPage[page]?.length ?? 0);

  return (
    <div
      className="flex flex-col items-center gap-1.5 bg-white px-2 py-3 border-l border-gray-200"
      style={{ touchAction: 'manipulation' }}
    >
      {COLOR_ORDER.map((c) => {
        const active = tool === 'pen' && color === c;
        return (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`color-${c}`}
            className={`w-10 h-10 rounded-full transition-transform ${
              active ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : ''
            }`}
            style={{ backgroundColor: COLORS[c] }}
          />
        );
      })}
      <div className="h-px w-8 bg-gray-300 my-1" />
      <button
        onClick={() => setTool('eraser')}
        aria-label="eraser"
        className={`w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg ${
          tool === 'eraser' ? 'ring-2 ring-offset-2 ring-blue-500' : ''
        }`}
      >
        ⌫
      </button>
      <button
        onClick={() => undo(page)}
        disabled={undoDepth === 0}
        aria-label="undo"
        className="w-10 h-10 rounded-full bg-gray-100 disabled:opacity-40 flex items-center justify-center text-lg"
      >
        ↶
      </button>
    </div>
  );
}
