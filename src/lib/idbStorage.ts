// Persistent storage backed by IndexedDB via the `idb` wrapper.
// PDFs (including their ArrayBuffer bytes) and per-page annotations survive
// across PWA launches.

import { openDB, type IDBPDatabase } from 'idb';
import type { Stroke } from '../types/drawing';
import type { AnnotationRecord, PdfRecord } from '../types/library';

const DB_NAME = 'pdf-writer';
const DB_VERSION = 1;
const PDFS = 'pdfs';
const ANNOTATIONS = 'annotations';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PDFS)) {
          const pdfs = db.createObjectStore(PDFS, { keyPath: 'id' });
          pdfs.createIndex('addedAt', 'addedAt');
        }
        if (!db.objectStoreNames.contains(ANNOTATIONS)) {
          db.createObjectStore(ANNOTATIONS, { keyPath: ['pdfId', 'pageNum'] });
        }
      },
      blocked() {
        console.warn('[idb] another tab is preventing the upgrade');
      },
      blocking() {
        console.warn('[idb] this connection is blocking another upgrade');
      },
    }).catch((err) => {
      console.error('[idb] openDB failed', err);
      throw err;
    });
  }
  return dbPromise;
}

export async function listPdfs(): Promise<PdfRecord[]> {
  try {
    const db = await getDb();
    const all = (await db.getAllFromIndex(PDFS, 'addedAt')) as PdfRecord[];
    return all.slice().reverse(); // newest first
  } catch (err) {
    console.error('[idb] listPdfs failed', err);
    return [];
  }
}

export async function getPdf(id: string): Promise<PdfRecord | undefined> {
  try {
    const db = await getDb();
    return (await db.get(PDFS, id)) as PdfRecord | undefined;
  } catch (err) {
    console.error('[idb] getPdf failed', err);
    return undefined;
  }
}

export async function addPdf(record: PdfRecord): Promise<void> {
  const db = await getDb();
  await db.put(PDFS, record);
}

export async function updatePdf(
  id: string,
  patch: Partial<Omit<PdfRecord, 'id' | 'bytes' | 'addedAt'>>,
): Promise<void> {
  try {
    const db = await getDb();
    const cur = (await db.get(PDFS, id)) as PdfRecord | undefined;
    if (!cur) return;
    await db.put(PDFS, { ...cur, ...patch, updatedAt: Date.now() });
  } catch (err) {
    console.error('[idb] updatePdf failed', err);
  }
}

export async function updatePdfBytes(
  id: string,
  bytes: ArrayBuffer,
): Promise<void> {
  try {
    const db = await getDb();
    const cur = (await db.get(PDFS, id)) as PdfRecord | undefined;
    if (!cur) return;
    await db.put(PDFS, { ...cur, bytes, updatedAt: Date.now() });
  } catch (err) {
    console.error('[idb] updatePdfBytes failed', err);
  }
}

export async function deletePdf(id: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction([PDFS, ANNOTATIONS], 'readwrite');
    await tx.objectStore(PDFS).delete(id);
    const annStore = tx.objectStore(ANNOTATIONS);
    const range = IDBKeyRange.bound(
      [id, 0],
      [id, Number.MAX_SAFE_INTEGER],
    );
    let cursor = await annStore.openCursor(range);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    console.error('[idb] deletePdf failed', err);
  }
}

export async function listAnnotations(
  pdfId: string,
): Promise<AnnotationRecord[]> {
  try {
    const db = await getDb();
    const range = IDBKeyRange.bound(
      [pdfId, 0],
      [pdfId, Number.MAX_SAFE_INTEGER],
    );
    return (await db.getAll(ANNOTATIONS, range)) as AnnotationRecord[];
  } catch (err) {
    console.error('[idb] listAnnotations failed', err);
    return [];
  }
}

export async function shiftAnnotationsAfter(
  pdfId: string,
  afterPage: number,
): Promise<void> {
  try {
    const db = await getDb();
    const range = IDBKeyRange.bound(
      [pdfId, 0],
      [pdfId, Number.MAX_SAFE_INTEGER],
    );
    const records = (await db.getAll(ANNOTATIONS, range)) as AnnotationRecord[];
    const toShift = records
      .filter((r) => r.pageNum > afterPage)
      .sort((a, b) => b.pageNum - a.pageNum); // descending
    if (toShift.length === 0) return;
    const tx = db.transaction(ANNOTATIONS, 'readwrite');
    const store = tx.objectStore(ANNOTATIONS);
    for (const r of toShift) {
      await store.delete([pdfId, r.pageNum]);
      await store.put({ ...r, pageNum: r.pageNum + 1 });
    }
    await tx.done;
  } catch (err) {
    console.error('[idb] shiftAnnotationsAfter failed', err);
  }
}

export async function setAnnotation(
  pdfId: string,
  pageNum: number,
  strokes: Stroke[],
): Promise<void> {
  try {
    const db = await getDb();
    if (strokes.length === 0) {
      await db.delete(ANNOTATIONS, [pdfId, pageNum]);
    } else {
      await db.put(ANNOTATIONS, { pdfId, pageNum, strokes });
    }
  } catch (err) {
    console.error('[idb] setAnnotation failed', err);
  }
}
