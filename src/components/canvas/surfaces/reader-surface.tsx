"use client";

import * as React from "react";
import {
  X,
  BookOpen,
  ArrowSquareOut as ExternalLink,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
  Highlighter,
  Quotes as Quote,
  Copy,
  Trash as Trash2,
  NoteBlank as StickyNote,
  Check,
  Sparkle as Sparkles,
  PaperPlaneTilt as Send,
  ArrowsOutSimple as Maximize2,
  ArrowsInSimple as Minimize2,
} from "@phosphor-icons/react";

const READER_ACCENT = "var(--color-node-reader)";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { fetchReadable } from "@/lib/reader-client";
import { summarizePaper, askPaper } from "@/lib/ai-client";
import { formatReference, DEFAULT_STYLE } from "@/lib/citation";
import { useCanvasStore } from "@/store/canvas-store";

type LoadState = "loading" | "ready" | "error";
type Tab = "assistant" | "highlights";

interface Selection {
  text: string;
  paraIndex: number;
  rect: { top: number; left: number; width: number };
}

interface ThreadItem {
  id: number;
  role: "question" | "answer" | "summary" | "error";
  text: string;
}

const TARGET_PARAGRAPH = 600;
const EMPTY_HIGHLIGHTS: never[] = [];

function paragraphize(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) ?? [text];
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    current += sentence;
    if (current.length >= TARGET_PARAGRAPH) {
      paragraphs.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderWithMarks(text: string, marks: string[]): React.ReactNode {
  const valid = marks.filter(Boolean);
  if (valid.length === 0) return text;
  const re = new RegExp(`(${valid.map(escapeRegExp).join("|")})`, "g");
  return text.split(re).map((part, i) =>
    valid.includes(part) ? (
      <mark key={i} className="anchor-mark px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export function ReaderSurface() {
  const paper = useCanvasStore((s) => s.readerPaper);
  const closeReader = useCanvasStore((s) => s.closeReader);
  const addHighlight = useCanvasStore((s) => s.addHighlight);
  const removeHighlight = useCanvasStore((s) => s.removeHighlight);
  const addNode = useCanvasStore((s) => s.addNode);
  const highlights = useCanvasStore((s) =>
    paper ? (s.highlights[paper.id] ?? EMPTY_HIGHLIGHTS) : EMPTY_HIGHLIGHTS,
  );

  const [state, setState] = React.useState<LoadState>("loading");
  const [paragraphs, setParagraphs] = React.useState<string[]>([]);
  const [rawText, setRawText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState<number | null>(null);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [savedNote, setSavedNote] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("assistant");
const [thread, setThread] = React.useState<ThreadItem[]>([]);
  const [asking, setAsking] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [closing, setClosing] = React.useState(false);
  const [wide, setWide] = React.useState(false);
  const readerRef = React.useRef<HTMLDivElement>(null);
  const threadSeq = React.useRef(0);

  function handleClose() {
    setClosing(true);
  }

  function handleAnimEnd(e: React.AnimationEvent) {
    if (closing && e.target === readerRef.current) {
      closeReader();
    }
  }

  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  React.useEffect(() => {
    if (!paper?.url) {
      setState("error");
      setError("This source has no link to read from.");
      return;
    }
    let cancelled = false;
    setState("loading");
    setError(null);
    setThread([]);
    fetchReadable(paper.url)
      .then((result) => {
        if (cancelled) return;
        setRawText(result.text);
        setParagraphs(paragraphize(result.text));
        setPages(result.pages ?? null);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load source.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [paper?.url]);

  function pushItem(role: ThreadItem["role"], text: string) {
    threadSeq.current += 1;
    setThread((t) => [...t, { id: threadSeq.current, role, text }]);
  }

  async function doSummarize() {
    if (!paper || !rawText || asking) return;
    setTab("assistant");
    setAsking(true);
    try {
      const answer = await summarizePaper(rawText, paper.title);
      pushItem("summary", answer);
    } catch (err: unknown) {
      pushItem("error", err instanceof Error ? err.message : "Failed.");
    } finally {
      setAsking(false);
    }
  }

  async function doAsk() {
    const q = question.trim();
    if (!paper || !rawText || !q || asking) return;
    setQuestion("");
    pushItem("question", q);
    setAsking(true);
    try {
      const answer = await askPaper(rawText, q, paper.title);
      pushItem("answer", answer);
    } catch (err: unknown) {
      pushItem("error", err instanceof Error ? err.message : "Failed.");
    } finally {
      setAsking(false);
    }
  }

  function handleSelect() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || text.length < 3) {
      setSelection(null);
      return;
    }
    const anchor = sel.anchorNode;
    const el =
      anchor?.nodeType === Node.TEXT_NODE
        ? anchor.parentElement
        : (anchor as HTMLElement | null);
    const para = el?.closest<HTMLElement>("[data-para]");
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({
      text,
      paraIndex: para ? Number(para.dataset.para) : -1,
      rect: { top: rect.top, left: rect.left, width: rect.width },
    });
  }

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }

  function doHighlight() {
    if (!paper || !selection) return;
    addHighlight(paper.id, selection.text, selection.paraIndex);
    clearSelection();
  }

  async function doCite() {
    if (!paper || !selection) return;
    await navigator.clipboard?.writeText(
      `"${selection.text}" — ${formatReference(paper, DEFAULT_STYLE, 1)}`,
    );
    clearSelection();
  }

  async function doCopy() {
    if (!selection) return;
    await navigator.clipboard?.writeText(selection.text);
    clearSelection();
  }

  function saveHighlightsToNote() {
    if (!paper || highlights.length === 0) return;
    const body = [
      `Highlights — ${paper.title}`,
      "",
      ...highlights.map((h) => `• ${h.text}`),
    ].join("\n");
    addNode("text", { x: 80, y: 80 }, { text: body });
    setSavedNote(true);
    window.setTimeout(() => setSavedNote(false), 1600);
  }

  if (!paper) return null;

  const marksByPara = new Map<number, string[]>();
  for (const h of highlights) {
    marksByPara.set(h.paraIndex, [
      ...(marksByPara.get(h.paraIndex) ?? []),
      h.text,
    ]);
  }
  const canAi = state === "ready" && rawText.length > 0;

  return (
    <>
      <div
        onClick={handleClose}
        className={cn(
          "fixed inset-0 z-40 bg-ink/10",
          closing ? "opacity-0 transition-opacity duration-200" : "animate-backdrop-in",
        )}
      />
      <div
        ref={readerRef}
        onAnimationEnd={handleAnimEnd}
        style={{ borderTopColor: READER_ACCENT }}
        className={cn(
          "fixed bottom-0 right-0 top-0 z-40 flex flex-col border-l border-t-2 bg-paper",
          wide ? "left-0" : "w-[min(760px,94vw)]",
          "shadow-lift",
          closing ? "animate-panel-out" : "animate-panel-in",
        )}
      >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-grey-200 px-4">
        <span
          className="grid size-6 place-items-center rounded-md border"
          style={{
            color: READER_ACCENT,
            backgroundColor: `color-mix(in oklch, ${READER_ACCENT} 12%, white)`,
            borderColor: `color-mix(in oklch, ${READER_ACCENT} 24%, transparent)`,
          }}
        >
          <BookOpen className="size-3.5" />
        </span>
        <span className="text-sm font-medium text-ink">Reader</span>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <span className="min-w-0 flex-1 truncate text-sm text-grey-500">
          {paper.title}
        </span>
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-grey-200 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-grey-100"
          >
            <ExternalLink className="size-3.5" />
            Original
          </a>
        )}
        <button
          onClick={() => setWide((w) => !w)}
          aria-label={wide ? "Dock to side" : "Expand full width"}
          className="grid size-8 place-items-center rounded-md text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button
          onClick={handleClose}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-md text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          className="min-w-0 flex-1 overflow-y-auto bg-grey-50 px-6 py-10"
          onMouseUp={handleSelect}
        >
          <article className="mx-auto max-w-2xl">
            <h1 className="font-serif tracking-display text-[2rem] font-semibold leading-tight text-ink">
              {paper.title}
            </h1>
            <p className="mt-2 text-sm text-grey-500">
              {paper.authors} · {paper.venue} {paper.year}
              {pages ? ` · ${pages} pages` : ""}
            </p>

            <Separator className="my-6" />

            {state === "loading" && (
              <div className="space-y-3 py-6">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-4 w-3/5" />
                <p className="pt-2 text-center text-[11px] text-grey-400">
                  Loading full text…
                </p>
              </div>
            )}

            {state === "error" && (
              <div className="rounded-lg border border-grey-200 bg-paper p-4">
                <p className="flex items-center gap-2 text-sm text-ink">
                  <AlertCircle className="size-4" />
                  {error}
                </p>
                <p className="mt-3 text-[15px] leading-7 text-grey-800">
                  {paper.abstract}
                </p>
              </div>
            )}

            {state === "ready" && (
              <div className="space-y-4 font-serif text-[16px] leading-[1.8] text-grey-800">
                {paragraphs.map((p, i) => (
                  <p key={i} data-para={i}>
                    {renderWithMarks(p, marksByPara.get(i) ?? [])}
                  </p>
                ))}
              </div>
            )}
          </article>
        </div>

        <aside className="flex w-80 shrink-0 flex-col border-l border-grey-200 bg-paper">
          <div className="flex items-center gap-1 border-b border-grey-100 p-1.5">
            <TabButton active={tab === "assistant"} onClick={() => setTab("assistant")}>
              <Sparkles className="size-3.5" />
              Assistant
            </TabButton>
            <TabButton active={tab === "highlights"} onClick={() => setTab("highlights")}>
              <Highlighter className="size-3.5" />
              Highlights
              {highlights.length > 0 && (
                <span className="text-grey-400">{highlights.length}</span>
              )}
            </TabButton>
          </div>

          {tab === "assistant" ? (
            <AssistantPanel
              canAi={canAi}
              asking={asking}
              thread={thread}
              question={question}
              onQuestion={setQuestion}
              onSummarize={doSummarize}
              onAsk={doAsk}
            />
          ) : (
            <HighlightsList
              highlights={highlights}
              onRemove={(hid) => removeHighlight(paper.id, hid)}
              onSaveNote={saveHighlightsToNote}
              savedNote={savedNote}
            />
          )}
        </aside>
      </div>

      {selection && (
        <div
          style={{
            top: Math.max(8, selection.rect.top - 44),
            left: selection.rect.left + selection.rect.width / 2,
          }}
          className="animate-float-in fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-grey-200 bg-paper p-1 shadow-lift"
        >
          <SelectAction label="Highlight" onClick={doHighlight}>
            <Highlighter className="size-3.5" />
            Highlight
          </SelectAction>
          <SelectAction label="Cite passage" onClick={doCite}>
            <Quote className="size-3.5" />
            Cite
          </SelectAction>
          <SelectAction label="Copy" onClick={doCopy}>
            <Copy className="size-3.5" />
          </SelectAction>
        </div>
      )}
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
        active ? "bg-ink text-paper" : "text-grey-600 hover:bg-grey-100",
      )}
    >
      {children}
    </button>
  );
}

function AssistantPanel({
  canAi,
  asking,
  thread,
  question,
  onQuestion,
  onSummarize,
  onAsk,
}: {
  canAi: boolean;
  asking: boolean;
  thread: ThreadItem[];
  question: string;
  onQuestion: (value: string) => void;
  onSummarize: () => void;
  onAsk: () => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread, asking]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-grey-100 p-3">
        <button
          onClick={onSummarize}
          disabled={!canAi || asking}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-ink py-2 text-xs font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          <Sparkles className="size-3.5" />
          Summarize this paper
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        {thread.length === 0 && !asking && (
          <p className="px-1 text-[11px] leading-snug text-grey-400">
            Summarize the paper or ask a question — the assistant answers from
            the full text.
          </p>
        )}
        {thread.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-md p-2.5 text-[12px] leading-relaxed",
              item.role === "question"
                ? "ml-6 bg-ink text-paper animate-bubble-in-right"
                : item.role === "error"
                  ? "border border-grey-200 bg-grey-50 text-grey-600"
                  : "border border-grey-200 bg-paper text-grey-800 animate-bubble-in-left",
            )}
          >
            {item.role === "summary" && (
              <p className="mb-1 text-[10px] uppercase tracking-wider text-grey-400">
                Summary
              </p>
            )}
            <p className="whitespace-pre-wrap">{item.text}</p>
          </div>
        ))}
        {asking && (
          <div className="flex items-center gap-2 px-1 text-[12px] text-grey-500">
            <Loader2 className="size-3.5 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-grey-100 p-3">
        <div className="flex items-end gap-1.5">
          <textarea
            value={question}
            onChange={(e) => onQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onAsk();
              }
            }}
            disabled={!canAi}
            rows={2}
            placeholder="Ask this paper…"
            className="min-w-0 flex-1 resize-none rounded-md border border-grey-200 bg-grey-50 px-2 py-1.5 text-xs text-ink outline-none placeholder:text-grey-400 focus:border-grey-300 disabled:opacity-40"
          />
          <button
            onClick={onAsk}
            disabled={!canAi || asking || !question.trim()}
            aria-label="Ask"
            className="grid size-8 shrink-0 place-items-center rounded-md bg-ink text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink transition-colors hover:bg-grey-100"
    >
      {children}
    </button>
  );
}

function HighlightsList({
  highlights,
  onRemove,
  onSaveNote,
  savedNote,
}: {
  highlights: { id: string; text: string }[];
  onRemove: (id: string) => void;
  onSaveNote: () => void;
  savedNote: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {highlights.length === 0 ? (
          <p className="px-1 text-[11px] leading-snug text-grey-400">
            Select any text in the paper to highlight, cite, or copy it.
          </p>
        ) : (
          <ul className="space-y-2">
            {highlights.map((h) => (
              <li
                key={h.id}
                className="group rounded-md border border-grey-200 p-2.5"
              >
                <p className="text-[11px] leading-snug text-grey-700">
                  {h.text}
                </p>
                <button
                  onClick={() => onRemove(h.id)}
                  aria-label="Remove highlight"
                  className="mt-1.5 text-grey-300 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {highlights.length > 0 && (
        <div className="border-t border-grey-100 p-3">
          <button
            onClick={onSaveNote}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-ink py-2 text-xs font-medium text-paper transition-colors hover:bg-grey-800"
          >
            {savedNote ? (
              <Check className="size-3.5" />
            ) : (
              <StickyNote className="size-3.5" />
            )}
            {savedNote ? "Saved to board" : "Save to Note on board"}
          </button>
        </div>
      )}
    </div>
  );
}
