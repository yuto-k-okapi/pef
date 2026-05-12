import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPDF, renderPageToCanvas } from '../../lib/pdfLoader';
import { PDFDocument } from 'pdf-lib';
import {
  getPdf,
  listAnnotations,
  updatePdf,
  updatePdfBytes,
} from '../../lib/idbStorage';
import {
  annotatedFilename,
  shareOrDownloadAnnotatedPdf,
} from '../../lib/pdfExporter';
import { useDrawingStore } from '../../store/useDrawingStore';
import type { Stroke } from '../../types/drawing';
import { AnnotationCanvas } from '../AnnotationCanvas';
import { Toolbar } from '../Toolbar';

interface Props {
  pdfId: string;
  onBack: () => void;
}

interface PageSize {
  width: number;
  height: number;
}

export function EditorScreen({ pdfId, onBack }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [originalFilename, setOriginalFilename] = useState('');
  const [pageSize, setPageSize] = useState<PageSize | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);
  const cssWidthByPageRef = useRef<Record<number, number>>({});
  const zoom = useDrawingStore((s) => s.zoom);
  const panX = useDrawingStore((s) => s.panX);
  const panY = useDrawingStore((s) => s.panY);
  const resetView = useDrawingStore((s) => s.resetView);

  // Hydrate from idb on mount / when pdfId changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const record = await getPdf(pdfId);
        if (!record || cancelled) {
          if (!cancelled) setLoadError('PDFが見つかりません');
          return;
        }
        const annotations = await listAnnotations(pdfId);
        const strokesByPage: Record<number, Stroke[]> = {};
        for (const a of annotations) strokesByPage[a.pageNum] = a.strokes;
        if (cancelled) return;

        // pdf-lib/pdfjs may detach the buffer; clone for both export and render
        pdfBytesRef.current = record.bytes.slice(0);
        const doc = await loadPDF(record.bytes.slice(0));
        if (cancelled) return;

        cssWidthByPageRef.current = {};
        useDrawingStore.getState().hydrateFromIdb(pdfId, strokesByPage);
        setPdf(doc);
        setPageCount(doc.numPages);
        setPageNum(1);
        setDisplayName(record.displayName);
        setOriginalFilename(record.originalFilename);
      } catch (err) {
        if (cancelled) return;
        const msg = (err as Error).message || String(err);
        setLoadError(`PDF読み込み失敗: ${msg}`);
        console.error('PDF load failed', err);
      }
    }
    void load();
    return () => {
      cancelled = true;
      useDrawingStore.getState().clearActive();
    };
  }, [pdfId]);

  // Render the current PDF page
  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        if (!pdf || !pdfCanvasRef.current || !containerRef.current) return;
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const baseViewport = page.getViewport({ scale: 1 });
        const widthByH = (clientHeight * baseViewport.width) / baseViewport.height;
        const cssWidth = Math.min(clientWidth, widthByH);
        const cssHeight = (cssWidth * baseViewport.height) / baseViewport.width;
        await renderPageToCanvas(page, pdfCanvasRef.current, cssWidth);
        if (cancelled) return;
        cssWidthByPageRef.current[pageNum] = cssWidth;
        setPageSize({ width: cssWidth, height: cssHeight });
      } catch (err) {
        if (cancelled) return;
        const msg = (err as Error).message || String(err);
        console.error('page render failed', err);
        setLoadError(`ページ描画失敗 (p.${pageNum}): ${msg}`);
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNum]);

  async function handleInsertNotePage() {
    if (!pdfBytesRef.current || !pdf) return;
    try {
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current.slice(0));
      // Match the first page's size for the new blank note page
      const first = pdfDoc.getPage(0);
      const { width, height } = first.getSize();
      pdfDoc.addPage([width, height]);
      const newBytes = await pdfDoc.save();
      const arrayBuffer = new ArrayBuffer(newBytes.byteLength);
      new Uint8Array(arrayBuffer).set(newBytes);
      pdfBytesRef.current = arrayBuffer.slice(0);
      await updatePdfBytes(pdfId, arrayBuffer.slice(0));

      // Re-load PDF.js to pick up the new page
      const newDoc = await loadPDF(arrayBuffer.slice(0));
      setPdf(newDoc);
      setPageCount(newDoc.numPages);
      setPageNum(newDoc.numPages); // jump to the newly inserted page
    } catch (err) {
      console.error('insert note page failed', err);
      alert(`メモページ追加失敗: ${(err as Error).message}`);
    }
  }

  async function handleExport() {
    const bytes = pdfBytesRef.current;
    if (!bytes || exporting) return;
    setExporting(true);
    try {
      const strokesByPage = useDrawingStore.getState().strokesByPage;
      const filename = annotatedFilename(
        originalFilename || `${displayName}.pdf`,
      );
      await shareOrDownloadAnnotatedPdf(
        {
          pdfBytes: bytes,
          strokesByPage,
          cssWidthByPage: cssWidthByPageRef.current,
        },
        filename,
      );
      // Mark as done after successful export
      await updatePdf(pdfId, { tag: 'done' });
    } catch (err) {
      console.error('export failed', err);
      alert(`書き出しに失敗しました: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-red-600">{loadError}</p>
        <button onClick={onBack} className="px-4 py-2 bg-gray-200 rounded">
          戻る
        </button>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <header
        className="flex items-center gap-3 px-3 py-2 bg-white border-b border-gray-200"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1 rounded bg-gray-100 text-sm"
          aria-label="back"
        >
          ← 一覧
        </button>
        <span className="font-medium truncate flex-1">{displayName}</span>
        <button
          onClick={() => setPageNum((n) => Math.max(1, n - 1))}
          disabled={pageNum <= 1}
          className="px-3 py-1 rounded bg-gray-100 disabled:opacity-40"
        >
          前
        </button>
        <span className="tabular-nums text-sm">
          {pageNum} / {pageCount}
        </span>
        <button
          onClick={() => setPageNum((n) => Math.min(pageCount, n + 1))}
          disabled={pageNum >= pageCount}
          className="px-3 py-1 rounded bg-gray-100 disabled:opacity-40"
        >
          次
        </button>
        {zoom !== 1 && (
          <button
            onClick={resetView}
            className="px-2 py-1 rounded bg-gray-100 text-xs"
            aria-label="reset zoom"
          >
            {zoom.toFixed(1)}× ↺
          </button>
        )}
        <button
          onClick={handleInsertNotePage}
          className="px-2 py-1 rounded bg-gray-100 text-sm whitespace-nowrap"
          title="末尾に空白メモページを追加"
        >
          + メモ
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-50 whitespace-nowrap"
        >
          {exporting ? '書出中…' : '書き出し'}
        </button>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden flex items-center justify-center p-4"
        >
          <div
            className="relative"
            style={{
              touchAction: 'none',
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '50% 50%',
              willChange: 'transform',
            }}
          >
            <canvas
              ref={pdfCanvasRef}
              className="block bg-white shadow-md pointer-events-none select-none"
            />
            {pageSize && (
              <AnnotationCanvas
                page={pageNum}
                cssWidth={pageSize.width}
                cssHeight={pageSize.height}
              />
            )}
          </div>
        </div>
        <Toolbar page={pageNum} />
      </div>
    </div>
  );
}
