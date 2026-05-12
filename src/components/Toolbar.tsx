import { useDrawingStore } from '../store/useDrawingStore';
import {
  ERASER_SIZE_ORDER,
  ERASER_SIZE_PX,
  PENCIL_ALPHA_VALUE,
  PENCIL_DARKNESS_ORDER,
  useSettingsStore,
  widthValue,
} from '../store/useSettingsStore';
import { COLORS, WIDTH_ORDER } from '../types/drawing';

function EraserIcon({ size = 22 }: { size?: number }) {
  return (
    <span
      className="relative inline-block"
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size * 0.5}px`,
        transform: 'rotate(-18deg)',
      }}
    >
      <span className="absolute inset-0 bg-pink-300 rounded-sm" />
      <span className="absolute inset-x-0 bottom-0 h-1/3 bg-pink-500 rounded-b-sm" />
    </span>
  );
}

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
      className="flex flex-col items-center gap-1.5 bg-white px-2 py-3 border-l border-gray-200 overflow-y-auto"
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
      {settings.paletteColors.map((c, idx) => {
        const active = isInk && color === c;
        return (
          <button
            key={`${c}-${idx}`}
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

      {/* Pen/pencil width chips */}
      {isInk &&
        WIDTH_ORDER.map((w) => {
          const active = width === w;
          const dotSize = Math.max(4, widthValue(w, settings) * 2.4);
          return (
            <button
              key={w}
              onClick={() => setWidth(w)}
              aria-label={`width-${w}`}
              title={w === 'thin' ? '細' : w === 'med' ? '中' : '太'}
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

      {/* Pencil darkness chips */}
      {tool === 'pencil' &&
        PENCIL_DARKNESS_ORDER.map((d) => {
          const active = settings.pencilDarkness === d;
          const alpha = PENCIL_ALPHA_VALUE[d];
          return (
            <button
              key={d}
              onClick={() => settings.update({ pencilDarkness: d })}
              aria-label={`pencil-${d}`}
              title={d === 'light' ? '薄' : d === 'med' ? '中' : '濃'}
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                active ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-100'
              }`}
            >
              <span
                className="rounded-sm bg-gray-700 block w-5 h-2"
                style={{ opacity: alpha }}
              />
            </button>
          );
        })}

      <div className="h-px w-8 bg-gray-300 my-1" />

      <button
        onClick={() => setTool('eraser')}
        aria-label="eraser"
        title="消しゴム"
        className={`w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center ${
          tool === 'eraser' ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <EraserIcon />
      </button>

      {/* Eraser size chips */}
      {tool === 'eraser' &&
        ERASER_SIZE_ORDER.map((sz) => {
          const active = settings.eraserSize === sz;
          const px = ERASER_SIZE_PX[sz];
          return (
            <button
              key={sz}
              onClick={() => settings.update({ eraserSize: sz })}
              aria-label={`eraser-${sz}`}
              title={sz === 'small' ? '小' : sz === 'med' ? '中' : '大'}
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                active ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-100'
              }`}
            >
              <span
                className="rounded-full bg-pink-400 block"
                style={{ width: `${px * 1.4}px`, height: `${px * 1.4}px` }}
              />
            </button>
          );
        })}

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
