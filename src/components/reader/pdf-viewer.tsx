"use client";

import * as React from "react";
import {
  CircleNotch as Loader2,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ArrowsInLineHorizontal,
  ChatCircleText,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * In-app PDF reader: real pages (figures, tables, equations) with a
 * selectable text layer. Uses the pdf.js build bundled in `unpdf` (no extra
 * dependency, no worker setup). Pages render lazily as they scroll near view.
 */

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
/** Start rendering a page this far before it scrolls into view. */
const PRELOAD_MARGIN = "800px 0px";
const PAGE_GAP_PX = 16;

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};
type PdfViewport = { width: number; height: number; scale: number };
type PdfPage = {
  getViewport: (o: { scale: number }) => PdfViewport;
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport; transform?: number[] }) => { promise: Promise<void>; cancel: () => void };
  streamTextContent: () => ReadableStream;
  getTextContent: () => Promise<{ items: { str?: string }[] }>;
};
type PdfJs = {
  getDocument: (o: { data: Uint8Array; isEvalSupported: boolean; useSystemFonts: boolean }) => { promise: Promise<PdfDoc> };
  TextLayer: new (o: { textContentSource: ReadableStream; container: HTMLElement; viewport: PdfViewport }) => { render: () => Promise<void>; cancel: () => void };
};

interface PdfViewerProps {
  /** Direct PDF link; fetched through the same-origin proxy. */
  readonly pdfUrl: string;
  /** Full plain text once extracted, so the assistant can answer from the PDF. */
  readonly onText?: (text: string, pages: number) => void;
  /** User selected a passage and asked about it. */
  readonly onAsk?: (passage: string, page: number) => void;
  /** The PDF couldn't be opened (dead link, paywall); caller can fall back. */
  readonly onError?: (message: string) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; doc: PdfDoc; pdfjs: PdfJs; sizes: { width: number; height: number }[] };

async function loadPdf(pdfUrl: string): Promise<{ doc: PdfDoc; pdfjs: PdfJs }> {
  const res = await fetch(`/api/pdf/file?url=${encodeURIComponent(pdfUrl)}`);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? "Couldn't open this PDF.");
  }
  const data = new Uint8Array(await res.arrayBuffer());
  const { getResolvedPDFJS } = await import("unpdf");
  const pdfjs = (await getResolvedPDFJS()) as unknown as PdfJs;
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  return { doc, pdfjs };
}

export function PdfViewer({ pdfUrl, onText, onAsk, onError }: PdfViewerProps) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [zoom, setZoom] = React.useState(1);
  const [fitWidth, setFitWidth] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selection, setSelection] = React.useState<{ text: string; page: number; top: number; left: number } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const onTextRef = React.useRef(onText);
  onTextRef.current = onText;
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // Load the document and every page's base size (cheap: no rendering).
  React.useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    setState({ status: "loading" });
    loadPdf(pdfUrl)
      .then(async ({ doc, pdfjs }) => {
        loaded = doc;
        const sizes = await Promise.all(
          Array.from({ length: doc.numPages }, async (_, i) => {
            const vp = (await doc.getPage(i + 1)).getViewport({ scale: 1 });
            return { width: vp.width, height: vp.height };
          }),
        );
        if (cancelled) return;
        setState({ status: "ready", doc, pdfjs, sizes });
        // Extract text for the assistant in the background.
        const texts = await Promise.all(
          Array.from({ length: doc.numPages }, async (_, i) => {
            const content = await (await doc.getPage(i + 1)).getTextContent();
            return content.items.map((it) => it.str ?? "").join(" ");
          }),
        );
        if (!cancelled) onTextRef.current?.(texts.join("\n\n").replace(/\s+/g, " ").trim(), doc.numPages);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Couldn't open this PDF.";
        setState({ status: "error", message });
        onErrorRef.current?.(message);
      });
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [pdfUrl]);

  // Fit pages to the available width.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setFitWidth(entry.contentRect.width - 2 * PAGE_GAP_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.status]);

  function handleMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
    const anchor = sel?.anchorNode;
    const pageEl = (anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element | null))?.closest("[data-page]");
    const scroller = scrollRef.current;
    if (!sel || text.length < 3 || !pageEl || !scroller || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    setSelection({
      text,
      page: Number(pageEl.getAttribute("data-page")),
      top: rect.top - box.top + scroller.scrollTop - 40,
      left: rect.left - box.left + rect.width / 2,
    });
  }

  if (state.status === "loading") {
    return (
      <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-grey-600">
        <Loader2 className="size-4 animate-spin" />
        Opening PDF…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="m-6 flex items-start gap-2 rounded-lg border border-grey-200 bg-paper p-4 text-sm text-ink">
        <WarningCircle className="mt-0.5 size-4 shrink-0 text-feedback-warning" />
        {state.message}
      </div>
    );
  }

  const baseWidth = state.sizes[0]?.width ?? 612;
  const scale = fitWidth > 0 ? (fitWidth / baseWidth) * zoom : zoom;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-grey-200 bg-paper px-3 py-1.5 text-xs text-grey-600">
        <span className="tabular-nums">
          Page {currentPage} of {state.doc.numPages}
        </span>
        <span className="ml-auto flex items-center gap-0.5">
          <ToolbarButton label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}>
            <MagnifyingGlassMinus className="size-4" />
          </ToolbarButton>
          <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <ToolbarButton label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}>
            <MagnifyingGlassPlus className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Fit to width" disabled={zoom === 1} onClick={() => setZoom(1)}>
            <ArrowsInLineHorizontal className="size-4" />
          </ToolbarButton>
        </span>
      </div>

      <div ref={scrollRef} onMouseUp={handleMouseUp} className="relative min-h-0 flex-1 overflow-auto bg-grey-100 py-4">
        {state.sizes.map((size, i) => (
          <PdfPageView
            key={i}
            pageNumber={i + 1}
            doc={state.doc}
            pdfjs={state.pdfjs}
            width={size.width * scale}
            height={size.height * scale}
            scale={scale}
            root={scrollRef}
            onVisible={setCurrentPage}
          />
        ))}

        {selection && onAsk && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onAsk(selection.text, selection.page);
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
            style={{ top: Math.max(0, selection.top), left: selection.left }}
            className="absolute z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-paper shadow-lift"
          >
            <ChatCircleText className="size-3.5" />
            Ask about this (p. {selection.page})
          </button>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

interface PdfPageViewProps {
  readonly pageNumber: number;
  readonly doc: PdfDoc;
  readonly pdfjs: PdfJs;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly root: React.RefObject<HTMLDivElement | null>;
  readonly onVisible: (page: number) => void;
}

/** One page: a placeholder of the right size until it nears the viewport. */
function PdfPageView({ pageNumber, doc, pdfjs, width, height, scale, root, onVisible }: PdfPageViewProps) {
  const holderRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [near, setNear] = React.useState(false);
  const [rendering, setRendering] = React.useState(true);

  React.useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { root: root.current, rootMargin: PRELOAD_MARGIN },
    );
    const current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(pageNumber);
      },
      { root: root.current, threshold: 0.5 },
    );
    io.observe(el);
    current.observe(el);
    return () => {
      io.disconnect();
      current.disconnect();
    };
  }, [root, pageNumber, onVisible]);

  React.useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    let textTask: { cancel: () => void } | null = null;
    setRendering(true);
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textEl = textRef.current;
      if (!canvas || !textEl) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const task = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      renderTask = task;
      await task.promise;
      if (cancelled) return;
      textEl.replaceChildren();
      const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textEl, viewport });
      textTask = layer;
      await layer.render();
      if (!cancelled) setRendering(false);
    })().catch(() => {
      /* a cancelled render (zoom or unmount) is expected; nothing to report */
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textTask?.cancel();
    };
  }, [near, doc, pdfjs, pageNumber, scale]);

  return (
    <div
      ref={holderRef}
      data-page={pageNumber}
      aria-label={`Page ${pageNumber}`}
      className="relative mx-auto mb-4 bg-white shadow-sm"
      style={{ width, height, ["--total-scale-factor" as string]: scale }}
    >
      <canvas ref={canvasRef} className={cn("absolute inset-0 size-full", rendering && "opacity-0")} />
      <div ref={textRef} className="pdf-text-layer textLayer" />
      {rendering && (
        <span className="absolute inset-0 grid place-items-center text-xs text-grey-500">Page {pageNumber}</span>
      )}
    </div>
  );
}
