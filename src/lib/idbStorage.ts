// In-memory storage for the current session. Data is lost on page reload.
// API mirrors what an IndexedDB-backed implementation would offer so we can
// swap back to a persistent store later without touching call sites.

import type { Stroke } from '../types/drawing';
import type { AnnotationRecord, PdfRecord } from '../types/library';

const pdfMap = new Map<string, PdfRecord>();
const annotationsByPdf = new Map<string, Map<number, Stroke[]>>();

export async function listPdfs(): Promise<PdfRecord[]> {
  return Array.from(pdfMap.values()).sort((a, b) => b.addedAt - a.addedAt);
}

export async function getPdf(id: string): Promise<PdfRecord | undefined> {
  return pdfMap.get(id);
}

export async function addPdf(record: PdfRecord): Promise<void> {
  pdfMap.set(record.id, record);
}

export async function updatePdf(
  id: string,
  patch: Partial<Omit<PdfRecord, 'id' | 'bytes' | 'addedAt'>>,
): Promise<void> {
  const cur = pdfMap.get(id);
  if (!cur) return;
  pdfMap.set(id, { ...cur, ...patch, updatedAt: Date.now() });
}

export async function updatePdfBytes(
  id: string,
  bytes: ArrayBuffer,
): Promise<void> {
  const cur = pdfMap.get(id);
  if (!cur) return;
  pdfMap.set(id, { ...cur, bytes, updatedAt: Date.now() });
}

export async function deletePdf(id: string): Promise<void> {
  pdfMap.delete(id);
  annotationsByPdf.delete(id);
}

export async function listAnnotations(pdfId: string): Promise<AnnotationRecord[]> {
  const m = annotationsByPdf.get(pdfId);
  if (!m) return [];
  return Array.from(m.entries()).map(([pageNum, strokes]) => ({
    pdfId,
    pageNum,
    strokes,
  }));
}

export async function shiftAnnotationsAfter(
  pdfId: string,
  afterPage: number,
): Promise<void> {
  const m = annotationsByPdf.get(pdfId);
  if (!m) return;
  const keys = Array.from(m.keys()).sort((a, b) => b - a); // descending
  for (const k of keys) {
    if (k > afterPage) {
      m.set(k + 1, m.get(k)!);
      m.delete(k);
    }
  }
}

export async function setAnnotation(
  pdfId: string,
  pageNum: number,
  strokes: Stroke[],
): Promise<void> {
  let m = annotationsByPdf.get(pdfId);
  if (!m) {
    m = new Map();
    annotationsByPdf.set(pdfId, m);
  }
  if (strokes.length === 0) {
    m.delete(pageNum);
  } else {
    m.set(pageNum, strokes);
  }
}
