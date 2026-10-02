"use client";

import * as React from "react";
import {
  CircleNotch as Loader2,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ArrowsInLineHorizontal,
  ChatCircleText,
  WarningCircle,
  Highlighter,
  Lightbulb,
  Quotes,
  Crop,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_PDF_PREFIX } from "@/lib/pdf-url";

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
  /** Actions offered on a selected passage (each gets the text and page). */
  readonly onAsk?: (passage: string, page: number) => void;
  readonly onHighlight?: (passage: string, page: number) => void;
  readonly onInsight?: (passage: string, page: number) => void;
  readonly onCite?: (passage: string, page: number) => void;
  /** A region of a page was captured as a figure (PNG). */
  readonly onCaptureFigure?: (image: Blob, page: number) => void;
  /** Saved highlights to mark on the pages. */
  readonly highlights?: readonly { text: string; page?: number }[];
  /** The PDF couldn't be opened (dead link, paywall); caller can fall back. */
  readonly onError?: (message: string) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; doc: PdfDoc; pdfjs: PdfJs; sizes: { width: number; height: number }[] };

/** Bytes for a PDF reference: the user's private storage, a local file not
 *  yet uploaded (blob:), or a public link fetched through the proxy. */
async function fetchPdfBytes(pdfUrl: string): Promise<Uint8Array> {
  if (pdfUrl.startsWith(STORAGE_PDF_PREFIX)) {
    const sb = createClient();
    if (!sb) throw new Error("Sign in to open your uploaded PDFs.");
    const { data, error } = await sb.storage.from("media").download(pdfUrl.slice(STORAGE_PDF_PREFIX.length));
    if (error || !data) throw new Error("Couldn't open your uploaded PDF. Try again.");
    return new Uint8Array(await data.arrayBuffer());
  }
  const res = pdfUrl.startsWith("blob:")
    ? await fetch(pdfUrl)
    : await fetch(`/api/pdf/file?url=${encodeURIComponent(pdfUrl)}`);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? "Couldn't open this PDF.");
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function loadPdf(pdfUrl: string): Promise<{ doc: PdfDoc; pdfjs: PdfJs }> {
  const data = await fetchPdfBytes(pdfUrl);
  const { getResolvedPDFJS } = await import("unpdf");
  const pdfjs = (await getResolvedPDFJS()) as unknown as PdfJs;
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  return { doc, pdfjs };
}

export function PdfViewer({ pdfUrl, onText, onAsk, onHighlight, onInsight, onCite, onError, onCaptureFigure, highlights = [] }: PdfViewerProps) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [zoom, setZoom] = React.useState(1);
  const [fitWidth, setFitWidth] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selection, setSelection] = React.useState<{ text: string; page: number; top: number; left: number } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // Capture-figure mode: drag a box on a page to cut out a figure.
  const [capturing, setCapturing] = React.useState(false);
  const [captureError, setCaptureError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setCapturing(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing]);
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
        {onCaptureFigure && (
          <button
            type="button"
            aria-pressed={capturing}
            onClick={() => {
              setCaptureError(null);
              setCapturing((c) => !c);
            }}
            className={cn(
              "ml-2 flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
              capturing ? "bg-ink text-paper" : "text-ink hover:bg-grey-100",
            )}
          >
            <Crop className="size-3.5" />
            {capturing ? "Drag over a figure · Esc to cancel" : "Capture figure"}
          </button>
        )}
        {captureError && (
          <span role="alert" className="ml-2 text-feedback-danger">
            {captureError}
          </span>
        )}
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
            highlights={highlights}
            capturing={capturing}
            onCapture={(image, page) => {
              setCapturing(false);
              onCaptureFigure?.(image, page);
            }}
            onCaptureError={() => {
              setCapturing(false);
              setCaptureError("Couldn't capture that area. Try again.");
            }}
          />
        ))}

        {selection && (
          <div
            role="toolbar"
            aria-label="Selection actions"
            onMouseDown={(e) => e.preventDefault()}
            style={{ top: Math.max(0, selection.top), left: selection.left }}
            className="absolute z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-grey-200 bg-paper p-1 shadow-lift"
          >
            {(
              [
                { label: "Highlight", icon: Highlighter, run: onHighlight },
                { label: "Make insight", icon: Lightbulb, run: onInsight },
                { label: "Cite", icon: Quotes, run: onCite },
                { label: "Ask", icon: ChatCircleText, run: onAsk },
              ] as const
            )
              .filter((a) => a.run)
              .map(({ label, icon: Icon, run }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    run?.(selection.text, selection.page);
                    setSelection(null);
                    window.getSelection()?.removeAllRanges();
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink transition-colors hover:bg-grey-100"
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            <span className="px-1.5 text-xs tabular-nums text-grey-500">p. {selection.page}</span>
          </div>
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
  readonly highlights: readonly { text: string; page?: number }[];
  readonly capturing: boolean;
  readonly onCapture: (image: Blob, page: number) => void;
  readonly onCaptureError: () => void;
}

/** Ignore boxes smaller than this (a stray click, not a figure). */
const MIN_CAPTURE_PX = 12;
/** Captured figures render at this multiple of the on-screen size... */
const CAPTURE_UPSCALE = 4;
/** ...but no side larger than this (storage downscales past 2000 anyway). */
const CAPTURE_MAX_PX = 2000;
type Box = { x: number; y: number; w: number; h: number };

const MIN_MARK_CHARS = 3;
const normalise = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

/** Mark text-layer spans that fall inside one of this page's highlights. */
function markHighlights(textEl: HTMLElement, passages: readonly string[]): void {
  const targets = passages.map(normalise).filter(Boolean);
  for (const span of textEl.querySelectorAll("span")) {
    const t = normalise(span.textContent ?? "");
    span.classList.toggle("pdf-hl", t.length >= MIN_MARK_CHARS && targets.some((p) => p.includes(t)));
  }
}

/** One page: a placeholder of the right size until it nears the viewport. */
function PdfPageView({ pageNumber, doc, pdfjs, width, height, scale, root, onVisible, highlights, capturing, onCapture, onCaptureError }: PdfPageViewProps) {
  const [box, setBox] = React.useState<Box | null>(null);
  const origin = React.useRef<{ x: number; y: number } | null>(null);

  function pointAt(e: React.PointerEvent): { x: number; y: number } {
    const r = holderRef.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(width, e.clientX - r.left)), y: Math.max(0, Math.min(height, e.clientY - r.top)) };
  }

  /**
   * Re-render just the boxed region at print resolution (the on-screen
   * canvas is only screen-sharp, which blurs once the figure is reused).
   */
  async function capture(b: Box) {
    if (b.w < MIN_CAPTURE_PX || b.h < MIN_CAPTURE_PX) return;
    const page = await doc.getPage(pageNumber);
    const k = Math.min(CAPTURE_UPSCALE, CAPTURE_MAX_PX / Math.max(b.w, b.h));
    const viewport = page.getViewport({ scale: scale * k });
    const out = document.createElement("canvas");
    out.width = Math.round(b.w * k);
    out.height = Math.round(b.h * k);
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff"; // PDF pages are white; transparent PNGs turn black in dark mode.
    ctx.fillRect(0, 0, out.width, out.height);
    // Shift so the box's top-left lands at the canvas origin.
    await page.render({ canvasContext: ctx, viewport, transform: [1, 0, 0, 1, -b.x * k, -b.y * k] }).promise;
    out.toBlob((blob) => blob && onCapture(blob, pageNumber), "image/png");
  }
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

  // Re-mark whenever this page's highlights change or the text layer redraws.
  const pagePassages = React.useMemo(
    () => highlights.filter((h) => h.page === pageNumber).map((h) => h.text),
    [highlights, pageNumber],
  );
  React.useEffect(() => {
    if (!rendering && textRef.current) markHighlights(textRef.current, pagePassages);
  }, [rendering, pagePassages]);

  return (
    <div
      ref={holderRef}
      data-page={pageNumber}
      aria-label={`Page ${pageNumber}`}
      className={cn("relative mx-auto mb-4 bg-white shadow-sm", capturing && "cursor-crosshair touch-none select-none")}
      style={{ width, height, ["--total-scale-factor" as string]: scale }}
      onPointerDown={(e) => {
        if (!capturing) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = pointAt(e);
        setBox({ ...origin.current, w: 0, h: 0 });
      }}
      onPointerMove={(e) => {
        if (!capturing || !origin.current) return;
        const p = pointAt(e);
        const o = origin.current;
        setBox({ x: Math.min(o.x, p.x), y: Math.min(o.y, p.y), w: Math.abs(p.x - o.x), h: Math.abs(p.y - o.y) });
      }}
      onPointerUp={() => {
        if (!capturing || !origin.current) return;
        origin.current = null;
        if (box) void capture(box).catch(() => onCaptureError());
        setBox(null);
      }}
    >
      <canvas ref={canvasRef} className={cn("absolute inset-0 size-full", rendering && "opacity-0")} />
      <div ref={textRef} className="pdf-text-layer textLayer" style={capturing ? { pointerEvents: "none" } : undefined} />
      {box && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 border-2 border-highlight bg-highlight/10"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      )}
      {rendering && (
        <span className="absolute inset-0 grid place-items-center text-xs text-grey-500">Page {pageNumber}</span>
      )}
    </div>
  );
}
