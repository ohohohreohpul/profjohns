"use client";

import * as React from "react";
import { CircleNotch as Loader2, MagnifyingGlass, Info } from "@phosphor-icons/react";
import { planScoutAngles, searchAndScreen, type ScreenedPaper } from "@/lib/scout";
import type { SourceProvider } from "@/lib/sources-client";
import type { PaperSource } from "@/lib/mock";

interface SourcesSearchProps {
  /** The board's research question; pre-fills the search. */
  readonly question: string;
  /** Papers already on the board, so they are not added twice. */
  readonly known: readonly Pick<PaperSource, "id" | "title">[];
  readonly onResults: (papers: readonly ScreenedPaper[]) => Promise<void> | void;
  /** Indexes to search (from the home page's source picker); all when unset. */
  readonly allowedSources?: SourceProvider[];
  /** Search this topic once, right away (launch from the home page). */
  readonly autoRunTopic?: string;
}

/** Find papers for the question: plan angles, search, rank, screen. */
export function SourcesSearch({ question, known, onResults, allowedSources, autoRunTopic }: SourcesSearchProps) {
  const [query, setQuery] = React.useState(question);
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<{ text: string; error: boolean } | null>(null);

  const autoRan = React.useRef(false);
  React.useEffect(() => {
    if (!autoRunTopic || autoRan.current) return;
    autoRan.current = true;
    setQuery(autoRunTopic);
    void run(autoRunTopic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunTopic]);

  // Follow the Question card until the user edits the search themselves.
  React.useEffect(() => {
    if (!touched) setQuery(question);
  }, [question, touched]);

  async function run(override?: string) {
    const topic = (override ?? query).trim();
    if (!topic || busy) return;
    setNote(null);
    setBusy("Planning searches…");
    try {
      const { angles } = await planScoutAngles(topic, { allowedSources });
      const { screened, weakMatchNote } = await searchAndScreen(topic, angles, { known, onProgress: setBusy, allowedSources });
      await onResults(screened);
      const kept = screened.filter((p) => p.kept).length;
      setNote({
        text: weakMatchNote ?? `Found ${screened.length} papers; kept the ${kept} most relevant. The rest are marked New.`,
        error: false,
      });
    } catch (err: unknown) {
      setNote({ text: err instanceof Error ? err.message : "Search failed. Please try again.", error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className="flex items-center gap-1.5 rounded-lg border border-grey-200 bg-paper p-1 focus-within:border-grey-400"
      >
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setTouched(true);
          }}
          placeholder="Search for papers…"
          aria-label="Search for papers"
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-grey-500"
        />
        <button
          type="submit"
          disabled={!query.trim() || !!busy}
          aria-label="Find papers"
          className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MagnifyingGlass className="size-3.5" />}
        </button>
      </form>
      {busy && (
        <p role="status" className="mt-1.5 px-1 text-xs text-grey-600">
          {busy}
        </p>
      )}
      {note && !busy && (
        <p
          role={note.error ? "alert" : "status"}
          className={
            note.error
              ? "mt-1.5 rounded-md bg-feedback-danger-bg px-2 py-1.5 text-xs text-feedback-danger"
              : "mt-1.5 flex gap-1.5 px-1 text-xs leading-relaxed text-grey-600"
          }
        >
          {!note.error && <Info className="mt-px size-3.5 shrink-0" />}
          {note.text}
        </p>
      )}
    </div>
  );
}
