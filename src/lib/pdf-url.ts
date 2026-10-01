/** pdfUrl prefix for a PDF the user uploaded to their private storage. */
export const STORAGE_PDF_PREFIX = "storage://media/";

/** Map a paper link to a direct PDF link where one is known (arXiv). */
export function toPdfUrl(url: string): string {
  const arxiv = url.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#]+)/i);
  if (arxiv) return `https://arxiv.org/pdf/${arxiv[1].replace(/\.pdf$/i, "")}`;
  return url;
}

/** The best PDF link for a paper, if it likely has one. */
export function pdfLinkFor(paper: { url?: string; pdfUrl?: string }): string | null {
  if (paper.pdfUrl) return paper.pdfUrl;
  if (paper.url && /arxiv\.org\/(abs|pdf|html)\//i.test(paper.url)) return toPdfUrl(paper.url);
  if (paper.url && /\.pdf($|[?#])/i.test(paper.url)) return paper.url;
  return null;
}
