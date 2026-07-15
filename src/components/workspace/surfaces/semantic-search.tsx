"use client";

import * as React from "react";
import {
  MagnifyingGlass as Search,
  CircleNotch as Loader2,
  Sparkle as Sparkles,
  WarningCircle as AlertCircle,
  BookOpen,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";
import { embedText } from "@/lib/semantic";
import {
  sourcesNeedingIndex,
  setSourceEmbedding,
  semanticSearchSources,
  type SemanticHit,
} from "@/lib/db/repo";

/**
 * Semantic search over the user's saved sources (VISION Phase 5). Embeds the
 * query with the `embed` Edge Function, ranks via the pgvector `match_sources`
 * RPC — surfacing saved work that keyword search misses. Degrades to a clear
 * "not set up" message when the function/pgvector aren't deployed yet.
 */
export function SemanticSearch() {
  const { enabled, user } = useAuth();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SemanticHit[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [indexing, setIndexing] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [notConfigured, setNotConfigured] = React.useState(false);

  if (!enabled || !user) return null;

  async function run() {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setNotice(null);
    setNotConfigured(false);
    try {
      const vec = await embedText(q);
      if (!vec) {
        setNotConfigured(true);
        setHits(null);
        return;
      }
      const results = await semanticSearchSources(vec, 12);
      setHits(results);
      if (results.length === 0) {
        setNotice("No matches. Build the index if you haven't, or save more sources.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function buildIndex() {
    if (indexing) return;
    setIndexing(true);
    setNotice(null);
    setNotConfigured(false);
    try {
      const pending = await sourcesNeedingIndex();
      if (pending.length === 0) {
        setNotice("Everything's already indexed.");
        return;
      }
      let done = 0;
      for (const s of pending) {
        const vec = await embedText(s.text);
        if (!vec) {
          setNotConfigured(true);
          break;
        }
        await setSourceEmbedding(s.id, vec);
        done += 1;
      }
      if (done > 0) setNotice(`Indexed ${done} source${done === 1 ? "" : "s"}.`);
    } finally {
      setIndexing(false);
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-grey-200 bg-paper p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-node-explorer" />
        <h2 className="font-display text-[14px] font-semibold tracking-tight text-ink">
          Semantic search
        </h2>
        <button
          onClick={buildIndex}
          disabled={indexing}
          data-testid="semantic-build-index"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-grey-200 px-2.5 py-1 text-[11px] font-medium text-grey-600 transition-colors hover:border-grey-300 hover:text-ink disabled:opacity-50"
        >
          {indexing ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {indexing ? "Indexing…" : "Build index"}
        </button>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-grey-500">
        Find saved sources by meaning, not keywords. Build the index once, then
        search across everything you&apos;ve kept.
      </p>

      <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-grey-200 bg-grey-50/70 px-3 py-2 transition-colors focus-within:border-grey-300 focus-within:bg-paper">
        <Search className="size-4 shrink-0 text-grey-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          data-testid="semantic-query"
          placeholder="Search your library by meaning…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-grey-500"
        />
        <button
          onClick={run}
          disabled={busy || !query.trim()}
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink text-paper transition-colors hover:bg-grey-800 disabled:opacity-30"
          aria-label="Search"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </button>
      </div>

      {notConfigured && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-2 text-[11.5px] leading-snug text-amber-700">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          Semantic search isn&apos;t set up yet. Apply the pgvector schema and deploy
          the <span className="font-mono">embed</span> Edge Function
          (<span className="font-mono">supabase functions deploy embed</span>).
        </p>
      )}
      {notice && !notConfigured && (
        <p className="mt-2 text-[11.5px] text-grey-500">{notice}</p>
      )}

      {hits && hits.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {hits.map((h) => (
            <div
              key={h.id}
              className="flex items-start gap-2.5 rounded-lg border border-grey-100 bg-grey-50/40 px-3 py-2"
            >
              <span className="mt-0.5 shrink-0 rounded bg-node-explorer/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-node-explorer">
                {Math.round(h.similarity * 100)}%
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium leading-snug text-ink">
                  {h.url ? (
                    <a href={h.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {h.title}
                    </a>
                  ) : (
                    h.title
                  )}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-grey-500">
                  {[h.authors, h.year].filter(Boolean).join(" · ")}
                </p>
              </div>
              <BookOpen className="mt-0.5 size-3.5 shrink-0 text-grey-500" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
