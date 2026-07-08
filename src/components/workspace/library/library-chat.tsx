"use client";

import * as React from "react";
import { X, Sparkle as Sparkles, PaperPlaneTilt as Send, CircleNotch as Loader2, WarningCircle as AlertCircle } from "@phosphor-icons/react";
import { askLibrary } from "@/lib/ai-client";

interface Turn {
  id: number;
  role: "question" | "answer" | "error";
  text: string;
}

const SUGGESTIONS = [
  "What themes run across my library?",
  "Which sources are about methods?",
  "What should I revisit for my thesis?",
];

export function LibraryChat({
  catalog,
  itemCount,
  onClose,
}: {
  catalog: string;
  itemCount: number;
  onClose: () => void;
}) {
  const [thread, setThread] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const nextId = React.useRef(1);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setThread((t) => [...t, { id: nextId.current++, role: "question", text: q }]);
    setBusy(true);
    try {
      const answer = await askLibrary(catalog, q);
      setThread((t) => [...t, { id: nextId.current++, role: "answer", text: answer }]);
    } catch (e: unknown) {
      setThread((t) => [
        ...t,
        {
          id: nextId.current++,
          role: "error",
          text: e instanceof Error ? e.message : "The assistant could not respond.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-grey-200 bg-grey-50">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-grey-200 px-4">
        <Sparkles className="size-4 text-[var(--color-node-processor)]" />
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Ask your readroom
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-auto grid size-7 place-items-center rounded-lg text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {thread.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[12px] leading-relaxed text-grey-500">
              Ask anything about the {itemCount} item{itemCount === 1 ? "" : "s"} across
              your projects — find connections, locate work, decide what to revisit.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-lg border border-grey-200 px-3 py-2 text-left text-[12px] text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          thread.map((turn) =>
            turn.role === "question" ? (
              <div key={turn.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-[12px] leading-relaxed text-paper">
                  {turn.text}
                </p>
              </div>
            ) : turn.role === "error" ? (
              <p
                key={turn.id}
                className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-[11.5px] leading-relaxed text-red-600"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {turn.text}
              </p>
            ) : (
              <p
                key={turn.id}
                className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-grey-100 px-3 py-2 text-[12.5px] leading-relaxed text-ink"
              >
                {turn.text}
              </p>
            ),
          )
        )}
        {busy && (
          <p className="flex items-center gap-2 text-[12px] text-grey-400">
            <Loader2 className="size-3.5 animate-spin" />
            Reading your readroom…
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex shrink-0 items-center gap-2 border-t border-grey-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your readroom…"
          className="min-w-0 flex-1 rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[12.5px] text-ink outline-none placeholder:text-grey-400 focus:border-grey-300"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          aria-label="Send"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink text-paper transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          <Send className="size-4" />
        </button>
      </form>
    </aside>
  );
}
