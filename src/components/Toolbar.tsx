import { useDrawingStore } from '../store/useDrawingStore';
import { useSettingsStore, widthValue } from '../store/useSettingsStore';
import { COLORS, COLOR_ORDER, WIDTH_ORDER } from '../types/drawing';

export function Toolbar({ page }: { page: number }) {
  const tool = useDrawingStore((s) => s.tool);
  const color = useDrawingStore((s) => s.color);
  const width = useDrawingStore((s) => s.width);
  const setTool = useDrawingStore((s) => s.setTool);
  const setColor = useDrawingStore((s) => s.setColor);
  const setWidth = useDrawingStore((s) => s.setWidth);
  const undo = useDrawingStore((s) => s.undo);
  const undoDepth = useDrawingStore((s) => s.undoStackByPage[page]?.length ?? 0);
  const settings = useSettingsStore();

  const isInk = tool === 'pen' || tool === 'pencil';

  return (
    <div
      className="flex flex-col items-center gap-1.5 bg-white px-2 py-3 border-l border-gray-200"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Tool: pen / pencil */}
      <button
        onClick={() => setTool('pen')}
        aria-label="pen"
        title="ペン"
        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
          tool === 'pen' ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-100'
        }`}
      >
        ✒︎
      </button>
      <button
        onClick={() => setTool('pencil')}
        aria-label="pencil"
        title="鉛筆"
        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
          tool === 'pencil' ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-100'
        }`}
      >
        ✏︎
      </button>

      <div className="h-px w-8 bg-gray-300 my-1" />

      {/* Color swatches */}
      {COLOR_ORDER.map((c) => {
        const active = isInk && color === c;
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

      {/* Width chips */}
      {WIDTH_ORDER.map((w) => {
        const active = width === w;
        const dotSize = Math.max(4, widthValue(w, settings) * 2.4);
        return (
          <button
            key={w}
            onClick={() => setWidth(w)}
            aria-label={`width-${w}`}
            title={
              w === 'thin' ? '細' : w === 'med' ? '中' : '太'
            }
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              active ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-100'
            }`}
          >
            <span
              className="rounded-full bg-gray-700 block"
              style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
            />
          </button>
        );
      })}

      <div className="h-px w-8 bg-gray-300 my-1" />

      <button
        onClick={() => setTool('eraser')}
        aria-label="eraser"
        title="消しゴム"
        className={`w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg ${
          tool === 'eraser' ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        ⌫
      </button>
      <button
        onClick={() => undo(page)}
        disabled={undoDepth === 0}
        aria-label="undo"
        title="一つ戻す"
        className="w-10 h-10 rounded-lg bg-gray-100 disabled:opacity-40 flex items-center justify-center text-lg"
      >
        ↶
      </button>
    </div>
  );
}
