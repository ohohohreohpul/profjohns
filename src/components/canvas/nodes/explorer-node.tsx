"use client";

import * as React from "react";
import {
  MagnifyingGlass as Search,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
  Sparkle as Sparkles,
  Check,
  X,
  BookOpen,
  GitBranch,
  Binoculars as Telescope,
  ArrowRight,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { AgentPicker, useNodeAgent } from "@/components/canvas/agent-picker";
import { agentSystemPrompt } from "@/lib/agents";
import { useCanvasStore } from "@/store/canvas-store";
import {
  searchProvider,
  PROVIDER_LABEL,
  PROVIDER_ORDER,
  type SourceProvider,
} from "@/lib/sources-client";
import {
  proposeSearchAngles,
  triageSources,
  findGaps,
  type SearchAngle,
  type CoverageGap,
} from "@/lib/ai-client";
import type { PaperSource } from "@/lib/mock";
import { PAPER_DND_MIME } from "@/lib/dnd";
import { cn } from "@/lib/utils";

type Status = "kept" | "rejected";

interface ScoredSource extends PaperSource {
  score?: number;
  why?: string;
  cluster?: string;
  status: Status;
}

const RESULTS_PER_ANGLE = 6;
const TRIAGE_BATCH = 12;
const KEEP_THRESHOLD = 70;

function isNotConfigured(err: unknown): boolean {
  return err instanceof Error && /not configured/i.test(err.message);
}

function scoreTone(score?: number): string {
  if (score == null) return "bg-grey-100 text-grey-500";
  if (score >= 75) return "bg-emerald-50 text-emerald-700";
  if (score >= 50) return "bg-amber-50 text-amber-700";
  return "bg-grey-100 text-grey-500";
}

export function ExplorerNode({ id, data, selected }: CanvasNodeProps) {
  const setNodeSources = useCanvasStore((s) => s.setNodeSources);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);

  // This node runs from the Scout agent (overridable) — its persona shapes
  // angle-planning, triage, and gap-finding.
  const agent = useNodeAgent(id, "scout");
  const persona = agent ? agentSystemPrompt(agent) : undefined;

  const [topic, setTopic] = React.useState<string>((data.topic as string) ?? "");
  const [draftTopic, setDraftTopic] = React.useState<string>(topic);

  // Sources the user selected in the hero (`@` popover) constrain the
  // scout: angles are routed only to these providers, and a direct fallback
  // search uses the first one. Empty = all providers allowed (default).
  const allowedSources = React.useMemo<SourceProvider[] | undefined>(() => {
    const raw = data.allowedSources as SourceProvider[] | undefined;
    if (!raw || !Array.isArray(raw) || raw.length === 0) return undefined;
    return raw;
  }, [data.allowedSources]);

  // A topic seeded after mount (e.g. launched from the Discover hero) should
  // appear in the input. Only fill when empty — never clobber what's typed.
  const dataTopic = (data.topic as string) ?? "";
  React.useEffect(() => {
    if (dataTopic && !draftTopic) {
      setDraftTopic(dataTopic);
      setTopic(dataTopic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataTopic]);

  const [angles, setAngles] = React.useState<(SearchAngle & { selected: boolean })[]>([]);
  const [candidates, setCandidates] = React.useState<ScoredSource[]>([]);
  const [gaps, setGaps] = React.useState<CoverageGap[]>([]);

  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [aiOff, setAiOff] = React.useState(false);

  // Seed kept set from previously committed sources (survives reopen).
  React.useEffect(() => {
    const existing = useCanvasStore.getState().sources[id];
    if (existing?.length && candidates.length === 0) {
      setCandidates(existing.map((p) => ({ ...p, status: "kept" as Status })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(next: ScoredSource[]) {
    setCandidates(next);
    setNodeSources(
      id,
      next.filter((c) => c.status === "kept"),
    );
  }

  /** Step 1 — plan: turn a topic into search angles. */
  async function planAngles(topicStr: string) {
    const t = topicStr.trim();
    if (!t || busy) return;
    setTopic(t);
    updateNodeData(id, { topic: t });
    setError(null);
    setGaps([]);
    setBusy("Planning search…");
    try {
      const proposed = await proposeSearchAngles(t, allowedSources, persona);
      setAngles(proposed.map((a) => ({ ...a, selected: true })));
      setAiOff(false);
    } catch (err: unknown) {
      // Degrade gracefully — search the topic directly.
      setAiOff(isNotConfigured(err));
      const fallbackSource = allowedSources?.[0] ?? "openalex";
      setAngles([
        { query: t, rationale: "Direct search", source: fallbackSource, selected: true },
      ]);
    } finally {
      setBusy(null);
    }
  }

  /** Step 2 — search each angle on its AI-routed source, then screen results. */
  async function runSearch(items: { query: string; source: SourceProvider }[]) {
    if (items.length === 0 || busy) return;
    setError(null);
    setBusy("Searching…");
    // Dedupe across indexes by id AND normalized title (the same paper shows
    // up in OpenAlex, arXiv, and Semantic Scholar with different ids).
    const titleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const knownIds = new Set(candidates.map((c) => c.id));
    const knownTitles = new Set(candidates.map((c) => titleKey(c.title)));
    const fresh: PaperSource[] = [];
    let anyOk = false;
    try {
      for (let i = 0; i < items.length; i++) {
        const { query, source } = items[i];
        if (i > 0) await new Promise((r) => setTimeout(r, 350)); // be polite to public APIs
        try {
          const found = await searchProvider(source, query);
          anyOk = true;
          for (const p of found.slice(0, RESULTS_PER_ANGLE)) {
            const tk = titleKey(p.title);
            if (!knownIds.has(p.id) && !knownTitles.has(tk)) {
              knownIds.add(p.id);
              knownTitles.add(tk);
              fresh.push(p);
            }
          }
        } catch {
          // one angle failing shouldn't abort the rest
        }
      }
      if (!anyOk) throw new Error("Search failed. Please try again.");
      if (fresh.length === 0) {
        setError("No new sources found for those angles.");
        return;
      }

      const batch = fresh.slice(0, TRIAGE_BATCH);
      setBusy("Screening for relevance…");
      let scored: ScoredSource[];
      try {
        const verdicts = await triageSources(topic, batch, persona);
        const byN = new Map(verdicts.map((v) => [v.n, v]));
        scored = batch.map((p, i) => {
          const v = byN.get(i + 1);
          return {
            ...p,
            score: v?.score,
            why: v?.why,
            cluster: v?.cluster ?? "Results",
            status: (v && v.score >= KEEP_THRESHOLD ? "kept" : "rejected") as Status,
          };
        });
      } catch (err: unknown) {
        setAiOff(isNotConfigured(err));
        scored = batch.map((p) => ({ ...p, cluster: "Results", status: "kept" as Status }));
      }
      commit([...candidates, ...scored]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(null);
    }
  }

  async function loadGaps() {
    const kept = candidates.filter((c) => c.status === "kept");
    if (kept.length === 0 || busy) return;
    setBusy("Looking for gaps…");
    setError(null);
    try {
      setGaps(await findGaps(topic, kept, persona));
    } catch (err: unknown) {
      setAiOff(isNotConfigured(err));
      setError(aiOff ? null : "Could not analyze gaps.");
    } finally {
      setBusy(null);
    }
  }

  function setStatus(sourceId: string, status: Status) {
    commit(candidates.map((c) => (c.id === sourceId ? { ...c, status } : c)));
  }

  /** Pop a source out as its own Paper node, ready to wire into other nodes. */
  function popOut(paper: PaperSource) {
    const self = nodes.find((n) => n.id === id);
    const base = self?.position ?? { x: 0, y: 0 };
    const newId = addNode(
      "paper",
      { x: base.x + 520, y: base.y + 40 },
      { paper, label: paper.title },
    );
    setNodeSources(newId, [paper]);
  }

  const keptCount = candidates.filter((c) => c.status === "kept").length;
  const hasResults = candidates.length > 0;
  // Once research is underway the node morphs from a slim input into a wide
  // two-pane workspace (plan on the left, results on the right).
  const wide = angles.length > 0 || hasResults;

  // The node animates its width (320↔840px) over ~300ms. React Flow doesn't
  // observe CSS-animated size, so connected edges stay pinned to the handle's
  // stale position ("from the back"). Re-measure across the transition so the
  // edge re-anchors to the moving handle.
  const updateNodeInternals = useUpdateNodeInternals();
  React.useEffect(() => {
    updateNodeInternals(id);
    const timers = [120, 240, 340].map((ms) =>
      setTimeout(() => updateNodeInternals(id), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [wide, id, updateNodeInternals]);

  // Group results by cluster, clusters ordered by their best score.
  const clusters = React.useMemo(() => {
    const map = new Map<string, ScoredSource[]>();
    for (const c of candidates) {
      const key = c.cluster ?? "Results";
      (map.get(key) ?? map.set(key, []).get(key)!).push(c);
    }
    return [...map.entries()]
      .map(([name, items]) => ({
        name,
        items: [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
        best: Math.max(...items.map((i) => i.score ?? 0)),
      }))
      .sort((a, b) => b.best - a.best);
  }, [candidates]);

  return (
    <NodeShell
      id={id}
      kind="explorer"
      selected={selected}
      modelId={data.modelId}
      hideModel
      badge={
        keptCount > 0 ? (
          <span className="rounded-full bg-grey-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-grey-500">
            {keptCount} kept
          </span>
        ) : undefined
      }
      className={cn(
        "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        wide ? "w-[840px]" : "w-[320px]",
      )}
    >
      {/* Agent — this scout's persona (overridable). */}
      <div className="mb-2">
        <AgentPicker nodeId={id} archetype="scout" />
      </div>

      {/* Topic bar */}
      <div className="nodrag flex items-center gap-1.5 rounded-xl border border-grey-200 bg-grey-50/80 px-2.5 py-1.5 transition-colors focus-within:border-grey-300 focus-within:bg-paper focus-within:ring-4 focus-within:ring-ink/5">
        <Telescope className="size-4 shrink-0 text-grey-400" />
        <input
          value={draftTopic}
          onChange={(e) => setDraftTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              planAngles(draftTopic);
            }
          }}
          placeholder="What are you researching?"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-grey-400"
        />
        <button
          onClick={() => planAngles(draftTopic)}
          disabled={!!busy || !draftTopic.trim()}
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink text-paper transition-colors hover:bg-grey-800 disabled:opacity-30"
          aria-label="Plan search"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </button>
      </div>

      {aiOff && (
        <p className="mt-2 rounded-lg border border-grey-200 bg-grey-50 px-2.5 py-1.5 text-[10px] text-grey-500">
          AI assistance is off — searching directly. Add an API key for angles, scoring & gaps.
        </p>
      )}

      {allowedSources && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-grey-500">
          <span className="font-medium">Sources:</span>
          {allowedSources.map((s) => (
            <span
              key={s}
              className="rounded-full bg-grey-100 px-1.5 py-0.5 font-medium text-grey-600"
            >
              {PROVIDER_LABEL[s]}
            </span>
          ))}
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-2 text-[11px] text-red-600 animate-shake">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Idle hint — only before the first plan */}
      {!wide && !busy && (
        <p className="mt-2.5 px-0.5 text-[11px] leading-relaxed text-grey-400">
          Describe a topic and I&apos;ll plan search angles, screen each source for
          relevance, and surface coverage gaps.
        </p>
      )}

      {/* Working state — morphs into a two-pane workspace */}
      {wide && (
        <div className="mt-3 grid animate-float-in grid-cols-[290px_1fr] items-start gap-3">
          {/* Left — the plan */}
          <div className="flex min-w-0 flex-col border-r border-grey-100 pr-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Sparkles className="size-3 text-node-explorer" />
              <span className="text-[11px] font-medium text-grey-600">
                {aiOff ? "Search" : "Suggested angles"}
              </span>
            </div>
            <div className="nodrag nowheel flex max-h-[300px] flex-col gap-1 overflow-auto pr-1">
              {angles.map((a, i) => (
                <button
                  key={i}
                  onClick={() =>
                    setAngles((prev) =>
                      prev.map((x, xi) => (xi === i ? { ...x, selected: !x.selected } : x)),
                    )
                  }
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                    a.selected
                      ? "border-node-explorer/40 bg-node-explorer/5"
                      : "border-grey-200 hover:border-grey-300",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
                      a.selected
                        ? "border-node-explorer bg-node-explorer text-paper"
                        : "border-grey-300",
                    )}
                  >
                    {a.selected && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">{a.query}</span>
                    {a.rationale && (
                      <span className="block text-[10px] text-grey-400">{a.rationale}</span>
                    )}
                  </span>
                  <span className="mt-0.5 shrink-0 rounded-full bg-grey-100 px-1.5 py-0.5 text-[9px] font-medium text-grey-500">
                    {PROVIDER_LABEL[a.source]}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                runSearch(
                  angles
                    .filter((a) => a.selected)
                    .map((a) => ({ query: a.query, source: a.source })),
                )
              }
              disabled={!!busy || !angles.some((a) => a.selected)}
              className="nodrag mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-node-explorer py-1.5 text-[11px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Search className="size-3.5" />
              )}
              {busy
                ? busy
                : `Search ${angles.filter((a) => a.selected).length} angle${
                    angles.filter((a) => a.selected).length === 1 ? "" : "s"
                  }`}
            </button>

            {gaps.length > 0 && (
              <div className="mt-2.5 rounded-lg border border-node-explorer/30 bg-node-explorer/5 p-2">
                <p className="mb-1 text-[10px] font-medium text-grey-700">Coverage gaps</p>
                <div className="nodrag flex flex-col gap-0.5">
                  {gaps.map((g, i) => (
                    <button
                      key={i}
                      onClick={() => runSearch([{ query: g.query, source: "openalex" }])}
                      disabled={!!busy}
                      className="flex items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[10.5px] text-grey-700 transition-colors hover:bg-paper disabled:opacity-40"
                    >
                      <ArrowRight className="mt-0.5 size-3 shrink-0 text-node-explorer" />
                      <span>{g.gap}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — screened results */}
          <div className="flex min-w-0 flex-col">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-grey-600">
                {hasResults ? `${keptCount} kept · ${candidates.length} found` : "Results"}
              </span>
              {hasResults && (
                <button
                  onClick={loadGaps}
                  disabled={!!busy || keptCount === 0}
                  className="nodrag flex items-center gap-1 rounded-md border border-grey-200 px-2 py-0.5 text-[10px] font-medium text-grey-600 transition-colors hover:border-grey-400 hover:text-ink disabled:opacity-40"
                >
                  <GitBranch className="size-3" />
                  Find gaps
                </button>
              )}
            </div>
            <div className="nodrag nowheel max-h-[360px] space-y-3 overflow-auto pr-1">
              {hasResults ? (
                clusters.map((cluster) => (
                  <div key={cluster.name}>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-grey-400">
                      {cluster.name}
                    </p>
                    <div className="space-y-1.5">
                      {cluster.items.map((s) => (
                        <SourceRow key={s.id} source={s} onStatus={setStatus} onPopOut={popOut} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-grey-200 px-6 text-center text-[11px] leading-relaxed text-grey-400">
                  {busy ? busy : "Pick your angles and search — screened, scored sources appear here."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </NodeShell>
  );
}

function SourceRow({
  source,
  onStatus,
  onPopOut,
}: {
  source: ScoredSource;
  onStatus: (id: string, status: Status) => void;
  onPopOut: (source: ScoredSource) => void;
}) {
  const kept = source.status === "kept";
  const openReader = useCanvasStore((s) => s.openReader);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PAPER_DND_MIME, JSON.stringify(source));
        e.dataTransfer.effectAllowed = "copy";
      }}
      title="Drag onto the canvas to make a Paper node"
      className={cn(
        "nodrag group/row cursor-grab rounded-lg border px-2.5 py-2 transition-colors active:cursor-grabbing",
        kept ? "border-grey-200 bg-paper" : "border-grey-100 bg-grey-50/40 opacity-70",
      )}
    >
      <div className="flex items-start gap-2">
        {source.score != null && (
          <span
            className={cn(
              "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              scoreTone(source.score),
            )}
          >
            {source.score}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12px] font-medium text-ink">{source.title}</p>
          <p className="mt-0.5 truncate text-[10px] text-grey-400">
            {[source.authors, source.year].filter(Boolean).join(" · ")}
          </p>
          {source.why && (
            <p className="mt-1 text-[10.5px] italic leading-snug text-grey-500">{source.why}</p>
          )}
          <div className="mt-1.5 flex items-center gap-1">
            {source.url && (
              <button
                onClick={() => openReader(source)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
              >
                <BookOpen className="size-2.5" />
                Read
              </button>
            )}
            <button
              onClick={() => onPopOut(source)}
              title="Pop out as a Paper node"
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              <ArrowUpRight className="size-2.5" />
              Pop out
            </button>
            <button
              onClick={() => onStatus(source.id, kept ? "rejected" : "kept")}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                kept
                  ? "text-grey-400 hover:bg-grey-100 hover:text-grey-700"
                  : "text-emerald-600 hover:bg-emerald-50",
              )}
            >
              {kept ? (
                <>
                  <X className="size-2.5" />
                  Drop
                </>
              ) : (
                <>
                  <Check className="size-2.5" />
                  Keep
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
