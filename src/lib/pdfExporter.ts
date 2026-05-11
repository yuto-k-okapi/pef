import { PDFDocument } from 'pdf-lib';
import type { Stroke } from '../types/drawing';
import { renderStroke } from './strokeRenderer';

interface ExportArgs {
  pdfBytes: ArrayBuffer;
  strokesByPage: Record<number, Stroke[]>;
  /** CSS width used to render each annotated page (1-indexed). */
  cssWidthByPage: Record<number, number>;
}

const MIN_OVERSAMPLE = 2;

export async function buildAnnotatedPdfBytes({
  pdfBytes,
  strokesByPage,
  cssWidthByPage,
}: ExportArgs): Promise<Uint8Array> {
  // pdf-lib needs its own copy; load() may transfer the buffer.
  const pdfDoc = await PDFDocument.load(pdfBytes.slice(0));
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const strokes = strokesByPage[pageNum];
    const cssWidth = cssWidthByPage[pageNum];
    if (!strokes || strokes.length === 0 || !cssWidth) continue;

    const page = pages[i];
    const { width: pdfW, height: pdfH } = page.getSize();

    // The strokes are stored in CSS pixels relative to cssWidth. Render them
    // onto an offscreen canvas at high enough resolution that the embedded
    // PNG is sharper than the PDF page itself.
    const scale = Math.max(MIN_OVERSAMPLE, pdfW / cssWidth);
    const cssHeight = (cssWidth * pdfH) / pdfW;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cssWidth * scale);
    canvas.height = Math.round(cssHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const stroke of strokes) renderStroke(ctx, stroke);

    const pngBytes = await canvasToPngBytes(canvas);
    const image = await pdfDoc.embedPng(pngBytes);
    page.drawImage(image, { x: 0, y: 0, width: pdfW, height: pdfH });
  }

  return pdfDoc.save();
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Build the annotated PDF and hand it off via the platform's native share
 * sheet (preferred on iPad), falling back to a download anchor on browsers
 * without Web Share API file support.
 */
export async function shareOrDownloadAnnotatedPdf(
  args: ExportArgs,
  filename: string,
): Promise<{ method: 'share' | 'download' | 'cancelled' }> {
  const bytes = await buildAnnotatedPdfBytes(args);
  // Re-wrap as a fresh ArrayBuffer to keep TypeScript happy with Blob/File.
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return { method: 'share' };
    } catch (err) {
      if ((err as Error).name === 'AbortError') return { method: 'cancelled' };
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { method: 'download' };
}

export function annotatedFilename(original: string): string {
  const dot = original.lastIndexOf('.');
  const stem = dot > 0 ? original.slice(0, dot) : original;
  const ext = dot > 0 ? original.slice(dot) : '.pdf';
  return `${stem}_添削済み${ext}`;
}
