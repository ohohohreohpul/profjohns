/**
 * A saved highlight within a paper's reader. `paraIndex` lets us re-mark the
 * right paragraph when the reader re-renders.
 */
export interface Highlight {
  id: string;
  text: string;
  paraIndex: number;
}

let highlightSeq = 0;

export function nextHighlightId(): string {
  highlightSeq += 1;
  return `h${highlightSeq}`;
}
