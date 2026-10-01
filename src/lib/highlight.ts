/**
 * A saved highlight within a paper's reader. `paraIndex` re-marks the right
 * paragraph in the text view; `page` (1-based) places it in the PDF view,
 * where paraIndex is -1.
 */
export interface Highlight {
  id: string;
  text: string;
  paraIndex: number;
  page?: number;
}

/** Highlights made in the PDF view carry this paraIndex. */
export const PDF_PARA_INDEX = -1;

/** Random, so ids never repeat across reloads (a counter restarted at h1). */
export function nextHighlightId(): string {
  return `h-${crypto.randomUUID()}`;
}
