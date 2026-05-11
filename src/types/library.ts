import type { Stroke } from './drawing';

export type PdfTag = 'todo' | 'in_progress' | 'done';

export const TAG_ORDER: PdfTag[] = ['todo', 'in_progress', 'done'];

export const TAG_LABEL: Record<PdfTag, string> = {
  todo: '未',
  in_progress: '中',
  done: '完',
};

export const TAG_NAME: Record<PdfTag, string> = {
  todo: '未着手',
  in_progress: '作業中',
  done: '完了',
};

export interface PdfRecord {
  id: string;
  originalFilename: string;
  displayName: string;
  bytes: ArrayBuffer;
  tag: PdfTag;
  /** Reserved for future クラス > 授業 > 授業回 hierarchy. */
  groupId: string | null;
  /** Reserved for future per-PDF metadata (score, studentId, etc.). */
  metadata: Record<string, unknown>;
  addedAt: number;
  updatedAt: number;
}

export interface AnnotationRecord {
  pdfId: string;
  pageNum: number;
  strokes: Stroke[];
}
