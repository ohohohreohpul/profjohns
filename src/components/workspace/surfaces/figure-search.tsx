"use client";

import * as React from "react";
import {
  Image as ImageIcon,
  MagnifyingGlass as Search,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";
import { clipEmbedText } from "@/lib/clip";
import { matchFigures, type FigureHit } from "@/lib/db/repo";

/**
 * Text-to-figure search (VISION Phase 5b). Embeds the query into CLIP space
 * and ranks indexed figures by cosine similarity — "find that diagram" by
 * describing it. Reverse (figure->figure) search reuses the same RPC and is a
 * small follow-up. Hidden when signed out; degrades to a clear "not set up"
 * message when the Replicate CLIP key isn't configured.
 */
export function FigureSearch() {
  const { enabled, user } = useAuth();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<FigureHit[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notConfigured, setNotConfigured] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  if (!enabled || !user) return null;

  async function run() {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setNotConfigured(false);
    setNotice(null);
    try {
      const vec = await clipEmbedText(q);
      if (!vec) {
        setNotConfigured(true);
        setHits(null);
        return;
      }
      const results = await matchFigures(vec, 12);
      setHits(results);
      if (results.length === 0) setNotice("No figures matched. Index some from Media nodes first.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-grey-200 bg-paper p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ImageIcon className="size-4 text-node-media" />
        <h2 className="font-display text-[14px] font-semibold tracking-tight text-ink">
          Figure search
        </h2>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-grey-500">
        Find figures by describing them. Index images from Media nodes
        (&quot;Index for figure search&quot;), then search across them here.
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
          data-testid="figure-query"
          placeholder="Describe a figure… (e.g. 'bar chart of survival by age')"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-grey-500"
        />
        <button
          onClick={run}
          disabled={busy || !query.trim()}
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink text-paper transition-colors hover:bg-grey-800 disabled:opacity-30"
          aria-label="Search figures"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </button>
      </div>

      {notConfigured && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-2 text-[11.5px] leading-snug text-amber-700">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          Figure search isn&apos;t set up. Apply the pgvector schema and add
          <span className="font-mono"> REPLICATE_API_TOKEN</span> to enable CLIP embeddings.
        </p>
      )}
      {notice && !notConfigured && <p className="mt-2 text-[11.5px] text-grey-500">{notice}</p>}

      {hits && hits.length > 0 && (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {hits.map((h) => (
            <figure
              key={h.id}
              className="overflow-hidden rounded-lg border border-grey-200 bg-grey-50"
              title={h.caption}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.src} alt={h.caption} className="h-24 w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-1 px-1.5 py-1">
                <span className="truncate text-[9.5px] text-grey-500">{h.caption || "figure"}</span>
                <span className="shrink-0 font-mono text-[9px] font-semibold text-node-media">
                  {Math.round(h.similarity * 100)}%
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
