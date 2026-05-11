import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

const baseHref =
  typeof document !== 'undefined' ? document.baseURI : './';

export async function loadPDF(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: new URL('cmaps/', baseHref).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', baseHref).href,
    verbosity: 1, // WARNINGS — surfaces font-substitution and missing-glyph diagnostics in console
  }).promise;
}

export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): Promise<{ cssWidth: number; cssHeight: number }> {
  const baseViewport = page.getViewport({ scale: 1 });
  const cssScale = cssWidth / baseViewport.width;
  const dpr = window.devicePixelRatio || 1;
  const renderViewport = page.getViewport({ scale: cssScale * dpr });

  const cssHeight = baseViewport.height * cssScale;

  canvas.width = Math.floor(renderViewport.width);
  canvas.height = Math.floor(renderViewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context not available');

  await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;

  return { cssWidth, cssHeight };
}
