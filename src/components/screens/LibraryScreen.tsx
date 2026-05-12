import { useEffect, useState } from 'react';
import {
  addPdf,
  deletePdf,
  listPdfs,
  updatePdf,
} from '../../lib/idbStorage';
import type { PdfRecord } from '../../types/library';
import { TAG_LABEL, TAG_NAME, TAG_ORDER } from '../../types/library';

interface Props {
  onOpen: (id: string) => void;
  onOpenSettings: () => void;
}

const TAG_STYLE: Record<PdfRecord['tag'], string> = {
  todo: 'bg-gray-200 text-gray-700',
  in_progress: 'bg-amber-200 text-amber-800',
  done: 'bg-green-200 text-green-800',
};

interface ImportProgress {
  current: number;
  total: number;
  filename: string;
}

export function LibraryScreen({ onOpen, onOpenSettings }: Props) {
  const [pdfs, setPdfs] = useState<PdfRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await listPdfs();
      setPdfs(list);
    } catch (err) {
      setError(`一覧取得に失敗: ${(err as Error).message}`);
      console.error('listPdfs failed', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({
          current: i + 1,
          total: files.length,
          filename: file.name,
        });
        const bytes = await file.arrayBuffer();
        const id = crypto.randomUUID();
        const now = Date.now();
        const record: PdfRecord = {
          id,
          originalFilename: file.name,
          displayName: file.name.replace(/\.pdf$/i, ''),
          bytes,
          tag: 'todo',
          groupId: null,
          metadata: {},
          addedAt: now,
          updatedAt: now,
        };
        await addPdf(record);
      }
      await refresh();
    } catch (err) {
      const msg = (err as Error).message || String(err);
      setError(`取込みに失敗: ${msg}`);
      console.error('import failed', err);
    } finally {
      setProgress(null);
    }
  }

  async function cycleTag(record: PdfRecord) {
    const i = TAG_ORDER.indexOf(record.tag);
    const next = TAG_ORDER[(i + 1) % TAG_ORDER.length];
    await updatePdf(record.id, { tag: next });
    void refresh();
  }

  async function rename(record: PdfRecord) {
    const cur = record.displayName;
    const next = window.prompt('表示名を変更', cur);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === cur) return;
    await updatePdf(record.id, { displayName: trimmed });
    void refresh();
  }

  async function remove(record: PdfRecord) {
    if (!window.confirm(`「${record.displayName}」を削除しますか？`)) return;
    await deletePdf(record.id);
    void refresh();
  }

  const importing = progress !== null;

  return (
    <div className="h-full flex flex-col relative">
      <header
        className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <h1 className="text-lg font-bold flex-1">PDF添削</h1>
        <button
          onClick={onOpenSettings}
          aria-label="設定"
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg"
        >
          ⚙
        </button>
        <label
          className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
            importing
              ? 'bg-gray-300 text-gray-600'
              : 'bg-blue-600 text-white cursor-pointer'
          }`}
        >
          + 追加
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={handleImport}
            disabled={importing}
          />
        </label>
      </header>
      {error && (
        <div className="bg-red-100 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="font-bold">
            ×
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">読み込み中…</div>
        ) : pdfs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-2">PDFがまだありません</p>
            <p className="text-sm">右上の「+ 追加」から取り込めます</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 bg-white">
            {pdfs.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
              >
                <button
                  onClick={() => cycleTag(p)}
                  className={`shrink-0 w-11 h-11 rounded-full font-bold text-sm ${TAG_STYLE[p.tag]}`}
                  title={TAG_NAME[p.tag]}
                  aria-label={`tag: ${TAG_NAME[p.tag]}`}
                >
                  {TAG_LABEL[p.tag]}
                </button>
                <button
                  onClick={() => onOpen(p.id)}
                  className="flex-1 min-w-0 text-left py-1"
                >
                  <div className="font-medium truncate">{p.displayName}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {p.originalFilename}
                  </div>
                </button>
                <button
                  onClick={() => rename(p)}
                  aria-label="rename"
                  className="px-2 py-2 text-gray-500 text-lg"
                >
                  ✎
                </button>
                <button
                  onClick={() => remove(p)}
                  aria-label="delete"
                  className="px-2 py-2 text-red-500 text-lg"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {progress && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-xl px-6 py-5 min-w-[260px] max-w-[80%]">
            <div className="text-center mb-2 font-medium">
              読み込み中… ({progress.current} / {progress.total})
            </div>
            <div className="text-xs text-gray-500 truncate text-center">
              {progress.filename}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
