import { useState } from 'react';
import { useLogStore } from '../lib/diagnostics';

async function selfTest(add: (level: 'warn' | 'error', msg: string) => void) {
  const targets = [
    'cmaps/Adobe-Japan1-UCS2.bcmap',
    'cmaps/UniJIS-UCS2-H.bcmap',
    'cmaps/UniJIS-UTF16-H.bcmap',
    'standard_fonts/FoxitSerif.pfb',
  ];
  for (const t of targets) {
    try {
      const url = new URL(t, document.baseURI).href;
      const r = await fetch(url, { cache: 'no-store' });
      const buf = await r.arrayBuffer();
      const head = new Uint8Array(buf).slice(0, 8);
      const hex = Array.from(head)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ct = r.headers.get('content-type') ?? '(none)';
      const msg = `${t}: ${r.status} size=${buf.byteLength} ct=${ct} head=${hex}`;
      add(r.ok ? 'warn' : 'error', msg);
    } catch (e) {
      add('error', `${t}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export function DiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const logs = useLogStore((s) => s.logs);
  const clear = useLogStore((s) => s.clear);
  const add = useLogStore((s) => s.add);

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;
  const total = errorCount + warnCount;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed left-1 z-50 px-1.5 py-0.5 text-[10px] rounded shadow opacity-70 ${
          errorCount > 0
            ? 'bg-red-600 text-white'
            : warnCount > 0
              ? 'bg-amber-500 text-white'
              : 'bg-gray-700 text-white'
        }`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.25rem)' }}
        aria-label="diagnostic log"
      >
        log {total > 0 ? `(${total})` : ''}
      </button>
      {open && (
        <div
          className="fixed inset-x-2 bottom-2 bg-white border border-gray-300 shadow-xl rounded-lg z-50 flex flex-col"
          style={{ top: 'calc(max(env(safe-area-inset-top), 0.5rem) + 2.5rem)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
            <span className="text-sm font-medium">
              診断ログ ({logs.length})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => void selfTest(add)}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
              >
                自己診断
              </button>
              <button
                onClick={clear}
                className="px-2 py-1 text-xs bg-gray-200 rounded"
              >
                クリア
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-2 py-1 text-xs bg-gray-200 rounded"
              >
                閉じる
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 font-mono text-xs leading-snug">
            {logs.length === 0 ? (
              <div className="text-gray-400">ログなし</div>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className={`py-0.5 break-words whitespace-pre-wrap ${
                    l.level === 'error' ? 'text-red-700' : 'text-amber-700'
                  }`}
                >
                  <span className="font-bold">[{l.level.toUpperCase()}]</span>{' '}
                  {l.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
