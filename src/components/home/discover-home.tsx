"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass as Search,
  CircleNotch as Loader2,
  ArrowSquareOut as ExternalLink,
  Sparkle as Sparkles,
  ArrowUpRight,
  Plus,
  X,
  ThumbsUp,
  ThumbsDown,
  LockOpen as Unlock,
  BookmarkSimple as Bookmark,
  Check,
} from "@phosphor-icons/react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useProfileStore, profileHasSignal, tokenize } from "@/store/profile-store";
import { useCanvasStore } from "@/store/canvas-store";
import { refineFeed, type RefineTheme } from "@/lib/ai-client";
import { getModel, DEFAULT_MODEL_ID } from "@/lib/models";
import type { PaperSource } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { staggerContainer, fadeUp, fadeIn } from "@/lib/motion-variants";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import {
  HeroSourcesPopover,
  sourcesToParam,
} from "./hero-sources-popover";
import type { SourceProvider } from "@/lib/sources-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface Interest {
  label: string;
  q: string;
}

type FeedSort = "date" | "cited";
type FeedRange = "1y" | "5y" | "all";

const FOR_YOU_TAB = "foryou";

const SORT_OPTIONS: { value: FeedSort; label: string }[] = [
  { value: "date", label: "Recent" },
  { value: "cited", label: "Most-cited" },
];
const RANGE_OPTIONS: { value: FeedRange; label: string }[] = [
  { value: "1y", label: "1y" },
  { value: "5y", label: "5y" },
  { value: "all", label: "All" },
];

const FEED_CACHE_PREFIX = "lattice-feed::";

/** Curated example queries — shown below the search bar for first-time
 *  users and as a fallback when the feed APIs are unavailable. */
const STARTER_PROMPTS = [
  "Effects of microplastics on marine ecosystems",
  "How does sleep deprivation affect memory consolidation?",
  "Carbon capture technologies and scalability",
  "The economics of universal basic income",
  "CRISPR gene therapy ethics and regulation",
  "Climate adaptation strategies for coastal cities",
];

function feedCacheKey(q: string, sort: FeedSort, range: FeedRange): string {
  return `${FEED_CACHE_PREFIX}${q}|${sort}|${range}`;
}

function readFeedCache(key: string): PaperSource[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PaperSource[]) : null;
  } catch {
    return null;
  }
}

function writeFeedCache(key: string, papers: PaperSource[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(papers));
  } catch {
    // quota / serialization — ignore; cache is a best-effort accelerator.
  }
}

/** De-duplicate feed results — OpenAlex sometimes returns the same work
 *  twice (overlapping concept filters, or the same preprint under different
 *  ids). Dedupe by id first, then by normalized title as a safety net. */
function dedupeById(papers: PaperSource[]): PaperSource[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: PaperSource[] = [];
  for (const p of papers) {
    if (seenIds.has(p.id)) continue;
    const titleKey = p.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seenTitles.has(titleKey)) continue;
    seenIds.add(p.id);
    seenTitles.add(titleKey);
    out.push(p);
  }
  return out;
}

type FeedResponse = { success: boolean; data: PaperSource[] | null; error: string | null };

/** Fetch from OpenAlex first; on failure fall back to arXiv so the feed
 *  stays populated even when OpenAlex is rate-limiting (429). */
async function fetchFeed(url: string, fallbackQuery: string): Promise<PaperSource[]> {
  const res = await fetch(url);
  const json = (await res.json()) as FeedResponse;
  if (json.success && json.data) {
    return dedupeById(json.data);
  }
  // Fallback: arXiv (keyless, no rate-limit issues for our volume).
  const arxivUrl = `/api/arxiv?q=${encodeURIComponent(fallbackQuery)}`;
  const fallbackRes = await fetch(arxivUrl);
  const fallbackJson = (await fallbackRes.json()) as FeedResponse;
  if (fallbackJson.success && fallbackJson.data) {
    return dedupeById(fallbackJson.data);
  }
  throw new Error(json.error ?? fallbackJson.error ?? "Feed unavailable.");
}

export function DiscoverHome() {
  const router = useRouter();
  const addProject = useWorkspaceStore((s) => s.addProject);
  const addCanvas = useWorkspaceStore((s) => s.addCanvas);
  const projects = useWorkspaceStore((s) => s.projects);
  const pinSource = useWorkspaceStore((s) => s.pinSource);
  const pinnedSources = useWorkspaceStore((s) => s.pinnedSources);
  const homeInterests = useWorkspaceStore((s) => s.homeInterests);
  const addHomeInterest = useWorkspaceStore((s) => s.addHomeInterest);
  const removeHomeInterest = useWorkspaceStore((s) => s.removeHomeInterest);
  const pruneOrphans = useWorkspaceStore((s) => s.pruneOrphans);
  const profile = useProfileStore((s) => s.profile);
  const profileHydrated = useProfileStore((s) => s.hasHydrated);
  const addFeedback = useProfileStore((s) => s.addFeedback);
  const feedback = useProfileStore((s) => s.feedback);
  const setProfile = useProfileStore((s) => s.setProfile);

  const interests = homeInterests;
  const hasForYou = profileHasSignal(profile);

  // A4 — "Improve my feed" credit estimate. Refine is a single AI pass on the
  // fast model; the badge mirrors the canvas's "~N credits (est.)" idiom.
  const refineModel = getModel(DEFAULT_MODEL_ID);
  const refineCreditCost = refineModel.creditsPerRun; // expectedCalls = 1
  const spendCredits = useCanvasStore((s) => s.spendCredits);
  const [refining, setRefining] = React.useState(false);
  const [refineError, setRefineError] = React.useState<string | null>(null);
  const [refineThemes, setRefineThemes] = React.useState<RefineTheme[] | null>(null);

  const [query, setQuery] = React.useState("");
  const [tabId, setTabId] = React.useState<string>(FOR_YOU_TAB);
  const [papers, setPapers] = React.useState<PaperSource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<FeedSort>("date");
  const [range, setRange] = React.useState<FeedRange>("all");
  const [newInterest, setNewInterest] = React.useState({ label: "", q: "" });
  const [adding, setAdding] = React.useState(false);
  const [sources, setSources] = React.useState<SourceProvider[]>([
    "openalex",
    "arxiv",
    "semanticscholar",
    "wikipedia",
  ]);

  // Tidy once hydrated: drop canvases whose project is gone + dangling boards.
  // The store hard-gates pre-hydration prunes (an empty, not-yet-hydrated
  // store would treat EVERY board as dangling); the hydration dep makes the
  // prune actually run once the real workspace is in memory.
  const wsHydrated = useWorkspaceStore((s) => s.hasHydrated);
  React.useEffect(() => {
    if (wsHydrated) pruneOrphans();
  }, [wsHydrated, pruneOrphans]);

  // If "For You" is selected but the profile is empty, fall back to the first
  // interest tab so a new user always sees a feed.
  React.useEffect(() => {
    if (tabId === FOR_YOU_TAB && !hasForYou && interests.length > 0) {
      setTabId(interests[0].label);
    }
  }, [tabId, hasForYou, interests]);

  // Keep the active tab valid when interests change (e.g. after removal).
  React.useEffect(() => {
    if (tabId === FOR_YOU_TAB) return;
    if (!interests.some((it) => it.label === tabId)) {
      setTabId(hasForYou ? FOR_YOU_TAB : interests[0]?.label ?? FOR_YOU_TAB);
    }
  }, [interests, tabId, hasForYou]);

  React.useEffect(() => {
    if (!profileHydrated) return;
    let cancelled = false;

    // "For You" — query OpenAlex by the profile's top concept ids (no AI).
    if (tabId === FOR_YOU_TAB) {
      if (!hasForYou) {
        setPapers([]);
        setLoading(false);
        setError(null);
        return;
      }
      const conceptIds = profile.conceptIds.slice(0, 6).map((c) => c.id);
      const cacheKey = feedCacheKey(`foryou::${conceptIds.join(",")}`, sort, range);
      const cached = readFeedCache(cacheKey);
      if (cached) {
        setPapers(cached);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      fetchFeed(
        `/api/openalex?q=foryou&concepts=${encodeURIComponent(conceptIds.join(","))}` +
          `&sort=${sort}&range=${range}&limit=12`,
        conceptIds.map((c) => c).join(" "),
      )
        .then((data) => {
          if (cancelled) return;
          const filtered = data.filter(
            (p) => p.abstract && p.abstract !== "No abstract available.",
          );
          writeFeedCache(cacheKey, filtered);
          setPapers(filtered);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the feed.");
        })
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }

    // Interest tab — keyless text query.
    const interest = interests.find((it) => it.label === tabId);
    if (!interest) {
      setPapers([]);
      setLoading(false);
      return;
    }
    const cacheKey = feedCacheKey(interest.q, sort, range);

    // Serve from per-tab cache first — revisiting a tab/sort/range is instant
    // and avoids repeat OpenAlex calls (rate-limit hygiene).
    const cached = readFeedCache(cacheKey);
    if (cached) {
      setPapers(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchFeed(
      `/api/openalex?q=${encodeURIComponent(interest.q)}&sort=${sort}&range=${range}&limit=12`,
      interest.q,
    )
      .then((data) => {
        if (cancelled) return;
        const filtered = data.filter(
          (p) => p.abstract && p.abstract !== "No abstract available.",
        );
        writeFeedCache(cacheKey, filtered);
        setPapers(filtered);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the feed.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tabId, sort, range, interests, profile, hasForYou, profileHydrated]);

  function addInterest() {
    const label = newInterest.label.trim();
    const q = newInterest.q.trim();
    if (!label || !q) return;
    addHomeInterest(label, q);
    setNewInterest({ label: "", q: "" });
    setAdding(false);
    // Switch to the newly added tab.
    setTabId(label);
  }

  /** Record More/Less feedback on a For You card — reweights the profile
   *  by snapshotting the paper's concepts + title keywords. No AI. */
  function recordFeedback(paper: PaperSource, signal: "more" | "less") {
    addFeedback({
      paperId: paper.id,
      signal,
      concepts: paper.concepts ?? [],
      keywords: tokenize(paper.title).slice(0, 8),
      at: Date.now(),
    });
    // Invalidate the For You cache so the next load reflects the reweight.
    try {
      const conceptIds = profile.conceptIds.slice(0, 6).map((c) => c.id).join(",");
      sessionStorage.removeItem(feedCacheKey(`foryou::${conceptIds}`, sort, range));
    } catch {
      // ignore
    }
  }

  const feedbackByPaper = React.useMemo(() => {
    const m = new Map<string, "more" | "less">();
    for (const f of feedback) m.set(f.paperId, f.signal);
    return m;
  }, [feedback]);

  /** Which projects already have this paper pinned (for the card's Save menu). */
  const pinnedProjectIds = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [pid, list] of Object.entries(pinnedSources)) {
      for (const p of list) {
        let set = m.get(p.id);
        if (!set) {
          set = new Set();
          m.set(p.id, set);
        }
        set.add(pid);
      }
    }
    return m;
  }, [pinnedSources]);

  function saveToSpace(projectId: string, paper: PaperSource) {
    pinSource(projectId, paper);
  }

  /** A4 — opt-in "Improve my feed". One AI pass clustering the corpus into
   *  themes + query expansions. Credit estimate shown up-front; no background
   *  spend. Themes are cached in component state and surface as clickable
   *  chips that seed a new For You query. */
  async function runRefine() {
    if (refining) return;
    setRefining(true);
    setRefineError(null);
    try {
      // Gather signals: kept sources + project directions from the stores.
      const cs = useCanvasStore.getState();
      const kept: PaperSource[] = [];
      for (const list of Object.values(cs.sources)) {
        for (const p of list) kept.push(p);
      }
      const directions = useWorkspaceStore
        .getState()
        .projects.map((p) => p.direction)
        .filter(Boolean);
      if (kept.length === 0 && directions.length === 0) {
        setRefineError("Keep sources or set a research direction first.");
        return;
      }
      const themes = await refineFeed(kept, directions);
      setRefineThemes(themes);
      // Record the illustrative credit spend on the active canvas, if any.
      try {
        cs.spendCredits(refineCreditCost);
      } catch {
        // No active canvas — the estimate remains a visible hint only.
      }
    } catch (err: unknown) {
      setRefineError(
        err instanceof Error && /not configured/i.test(err.message)
          ? "AI is not configured. Add an API key to refine your feed."
          : "Could not refine the feed. Try again in a moment.",
      );
    } finally {
      setRefining(false);
    }
  }

  function launch(topic: string) {
    const t = topic.trim();
    if (!t) return;
    const id = addProject(t.slice(0, 60), t);
    const canvasId = addCanvas(id, "Main canvas");
    const sourcesParam = sourcesToParam(sources);
    router.push(
      `/board?project=${id}&canvas=${canvasId}&topic=${encodeURIComponent(t)}&sources=${sourcesParam}`,
    );
  }

  return (
    <div className="h-full overflow-auto">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="relative mx-auto w-full max-w-3xl px-6 pb-16 pt-[12vh]"
      >
        {/* hero */}
        <motion.div variants={fadeUp} className="flex items-center justify-center gap-0">
          <ProfJohnsLogo size={160} className="shrink-0 -mr-2" />
          <img
            src="/profjohns-text.svg"
            alt="ProfJohns"
            className="h-[72px] w-auto"
          />
        </motion.div>
        <motion.p variants={fadeUp} className="mt-3 text-center text-[14px] text-grey-500">
          Start with your research question. We find and screen papers, pull out
          shared claims, and help you write with citations.
        </motion.p>

        <motion.form
          onSubmit={(e) => {
            e.preventDefault();
            launch(query);
          }}
          className="mt-7 rounded-xl border border-grey-200 bg-paper p-3 shadow-sm transition-colors focus-within:border-grey-400"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a research question, or type a topic…"
            className="w-full bg-transparent px-2 py-1.5 text-[15px] text-ink outline-none placeholder:text-grey-400"
          />
          <div className="mt-2 flex items-center gap-2">
            <HeroSourcesPopover selected={sources} onChange={setSources} />
            <span
              title="Scout is the research agent that plans search angles and screens each paper for relevance."
              className="flex items-center gap-1.5 px-1 text-[12px] text-grey-500"
            >
              <Sparkles className="size-3.5" />
              Scout plans the searches
            </span>
            <button
              type="submit"
              disabled={!query.trim()}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-30"
            >
              <Search className="size-4" />
              Start research
            </button>
          </div>
        </motion.form>

        {/* Starter prompts — shown for first-time users with no projects. */}
        {projects.length === 0 && (
          <motion.div variants={fadeUp} className="mt-4 flex flex-wrap justify-center gap-2">
            {STARTER_PROMPTS.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                onClick={() => launch(prompt)}
                className="rounded-full border border-grey-200 bg-paper px-3 py-1.5 text-[12px] font-medium text-grey-500 transition-colors hover:border-ink hover:text-ink"
              >
                {prompt}
              </button>
            ))}
          </motion.div>
        )}

        {/* Discover feed */}
        <motion.div variants={fadeUp} className="mt-12">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Or browse new papers</h2>
            <span className="rounded-full bg-grey-100 px-2 py-0.5 text-[10px] font-medium text-grey-500">
              {sort === "cited" ? "Most-cited" : "Recent research"}
            </span>

            {/* Sort + time-range controls */}
            <div className="ml-auto flex items-center gap-1">
              <div className="flex rounded-lg border border-grey-200 p-0.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                      sort === opt.value
                        ? "bg-ink text-paper"
                        : "text-grey-500 hover:text-ink",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-grey-200 p-0.5">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                      range === opt.value
                        ? "bg-ink text-paper"
                        : "text-grey-500 hover:text-ink",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {/* "For You" — trained on the user's kept sources (no AI). */}
            <button
              onClick={() => setTabId(FOR_YOU_TAB)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                tabId === FOR_YOU_TAB
                  ? "bg-ink text-paper"
                  : hasForYou
                    ? "border border-ink/30 text-ink hover:bg-ink/5"
                    : "border border-grey-200 text-grey-400 hover:text-grey-600",
              )}
              title={
                hasForYou
                  ? "Recent work matching your kept sources and projects"
                  : "Keep sources on a canvas to train your For You feed"
              }
            >
              <Sparkles className="size-3.5" />
              For You
            </button>

            {interests.map((it) => {
              const active = tabId === it.label;
              return (
              <div key={it.label} className="group relative">
                <button
                  onClick={() => setTabId(it.label)}
                  className={cn(
                    "rounded-full px-3 py-1.5 pr-7 text-[12.5px] font-medium transition-colors",
                    active
                      ? "bg-ink text-paper"
                      : "border border-grey-200 text-grey-600 hover:bg-grey-50 hover:text-ink",
                  )}
                >
                  {it.label}
                </button>
                {interests.length > 1 && (
                  <button
                    onClick={() => removeHomeInterest(it.label)}
                    title={`Remove ${it.label}`}
                    className={cn(
                      "absolute right-1 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-full text-[10px] transition-opacity",
                      active
                        ? "text-paper/70 hover:text-paper"
                        : "text-grey-400 opacity-0 hover:bg-grey-200 hover:text-ink group-hover:opacity-100",
                    )}
                    aria-label={`Remove ${it.label}`}
                  >
                    <X className="size-2.5" />
                  </button>
                )}
              </div>
              );
            })}

            {adding ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addInterest();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  autoFocus
                  value={newInterest.label}
                  onChange={(e) => setNewInterest((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Label"
                  className="w-[90px] rounded-full border border-grey-300 px-3 py-1.5 text-[12px] text-ink outline-none focus:border-ink"
                />
                <input
                  value={newInterest.q}
                  onChange={(e) => setNewInterest((p) => ({ ...p, q: e.target.value }))}
                  placeholder="OpenAlex query"
                  className="w-[140px] rounded-full border border-grey-300 px-3 py-1.5 text-[12px] text-ink outline-none focus:border-ink"
                />
                <button
                  type="submit"
                  disabled={!newInterest.label.trim() || !newInterest.q.trim()}
                  className="rounded-full bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-paper disabled:opacity-30"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewInterest({ label: "", q: "" });
                  }}
                  className="rounded-full px-2 py-1.5 text-[11px] font-medium text-grey-500 hover:text-ink"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 rounded-full border border-dashed border-grey-300 px-3 py-1.5 text-[12px] font-medium text-grey-500 transition-colors hover:border-ink hover:text-ink"
              >
                <Plus className="size-3.5" />
                Add
              </button>
            )}
          </div>

          {/* A4 — opt-in "Improve my feed" (For You only). One AI pass with a
              visible credit estimate; no background spend. */}
          {tabId === FOR_YOU_TAB && hasForYou && (
            <div className="mt-4 rounded-xl border border-grey-200 bg-grey-50/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] font-medium text-grey-600">
                  Refine your feed with AI
                </span>
                <button
                  onClick={runRefine}
                  disabled={refining}
                  className="flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-50"
                >
                  {refining ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  {refining ? "Refining…" : "Improve my feed"}
                </button>
                <span
                  title={`Estimate: 1 AI pass on ${refineModel.label}`}
                  className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-grey-500"
                >
                  Uses ~{refineCreditCost} credit{refineCreditCost === 1 ? "" : "s"} (est.)
                </span>
                {refineThemes && refineThemes.length > 0 && (
                  <button
                    onClick={() => setRefineThemes(null)}
                    className="ml-auto text-[10.5px] font-medium text-grey-400 hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </div>

              {refineError && (
                <p className="mt-2 text-[11px] text-feedback-danger">{refineError}</p>
              )}

              {refineThemes && refineThemes.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  <p className="text-[10.5px] text-grey-400">
                    Themes from your library — click a query to research it:
                  </p>
                  {refineThemes.map((t) => (
                    <div key={t.theme} className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-paper px-1.5 py-0.5 text-[10.5px] font-semibold text-ink">
                        {t.theme}
                      </span>
                      {t.queries.map((q, qi) => (
                        <button
                          key={qi}
                          onClick={() => launch(q)}
                          className="rounded-full border border-grey-200 bg-paper px-2 py-0.5 text-[10.5px] text-grey-600 transition-colors hover:border-ink hover:text-ink"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-5">
            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[150px] animate-pulse rounded-2xl border border-grey-100 bg-grey-50"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-grey-200 bg-grey-50/50 px-6 py-8">
                <p className="text-center text-[13px] font-medium text-ink">
                  The feed is temporarily unavailable
                </p>
                <p className="mt-1 text-center text-[12px] text-grey-500">
                  You can still research any topic — try one of these:
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => launch(prompt)}
                      className="rounded-full border border-grey-300 bg-paper px-3 py-1.5 text-[12px] font-medium text-grey-600 transition-colors hover:border-ink hover:text-ink"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : papers.length === 0 && tabId === FOR_YOU_TAB && !hasForYou ? (
              <div className="rounded-2xl border border-dashed border-grey-200 bg-grey-50/50 px-6 py-10 text-center">
                <Sparkles className="mx-auto size-5 text-grey-300" />
                <p className="mt-2 text-[13px] font-medium text-ink">
                  Your For You feed is empty
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-grey-500">
                  Keep sources on a research canvas and your interests here will
                  learn from them — no credits used.
                </p>
              </div>
            ) : papers.length === 0 ? (
              <p className="rounded-xl border border-grey-200 bg-grey-50 px-4 py-6 text-center text-[13px] text-grey-500">
                No results for this tab. Try a different sort or time range.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {papers.map((p) => (
                  <FeedCard
                    key={p.id}
                    paper={p}
                    onResearch={() => launch(p.title)}
                    showFeedback={tabId === FOR_YOU_TAB}
                    feedbackSignal={feedbackByPaper.get(p.id)}
                    onFeedback={(signal) => recordFeedback(p, signal)}
                    projects={projects}
                    pinnedIn={pinnedProjectIds.get(p.id)}
                    onSave={(projectId) => saveToSpace(projectId, p)}
                    onCreateSpace={(name) => {
                      const id = addProject(name || "Saved sources", "");
                      pinSource(id, p);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function FeedCard({
  paper,
  onResearch,
  showFeedback,
  feedbackSignal,
  onFeedback,
  projects,
  pinnedIn,
  onSave,
  onCreateSpace,
}: {
  paper: PaperSource;
  onResearch: () => void;
  showFeedback?: boolean;
  feedbackSignal?: "more" | "less";
  onFeedback?: (signal: "more" | "less") => void;
  projects: { id: string; name: string }[];
  pinnedIn?: Set<string>;
  onSave: (projectId: string) => void;
  onCreateSpace: (name: string) => void;
}) {
  const [savedTo, setSavedTo] = React.useState<string | null>(null);
  const pinned = pinnedIn ?? new Set<string>();

  function handleSave(projectId: string) {
    onSave(projectId);
    setSavedTo(projectId);
    setTimeout(() => setSavedTo(null), 1400);
  }

  return (
    <article className="group flex flex-col rounded-xl border border-grey-200 bg-paper p-4 shadow-sm transition-colors hover:border-grey-300">
      <div className="flex items-start gap-2">
        <p className="line-clamp-2 flex-1 text-[14px] font-semibold leading-snug tracking-tight text-ink">
          {paper.title}
        </p>
        {paper.openAccess && (
          <span
            title="Open access"
            className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-feedback-success-bg px-1.5 py-0.5 text-[9.5px] font-semibold text-feedback-success"
          >
            <Unlock className="size-2.5" />
            OA
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[11px] text-grey-400">
        {[paper.authors, paper.year, paper.venue].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-2 line-clamp-3 flex-1 text-[12px] leading-relaxed text-grey-600">
        {paper.abstract}
      </p>
      <div className="mt-3 flex items-center gap-1">
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[10.5px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink"
          >
            <ExternalLink className="size-3" />
            Source
          </a>
        )}
        {typeof paper.citations === "number" && paper.citations > 0 && (
          <span className="rounded-md px-1.5 py-1 text-[10px] font-medium tabular-nums text-grey-400">
            {paper.citations.toLocaleString()} cited
          </span>
        )}

        {/* Save to Space */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Save to a Space"
              className={cn(
                "flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-medium transition-colors",
                savedTo
                  ? "text-feedback-success"
                  : "text-grey-500 hover:bg-grey-100 hover:text-ink",
              )}
            >
              {savedTo ? <Check className="size-3" /> : <Bookmark className="size-3" />}
              {savedTo ? "Saved" : "Save"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Save to Space</DropdownMenuLabel>
            {projects.length === 0 && (
              <p className="px-2.5 py-1.5 text-[11px] text-grey-400">
                No projects yet.
              </p>
            )}
            {projects.map((proj) => (
              <DropdownMenuItem
                key={proj.id}
                onClick={() => handleSave(proj.id)}
                className="justify-between text-[12px]"
              >
                <span className="truncate">{proj.name || "Untitled project"}</span>
                {pinned.has(proj.id) && (
                  <Check className="size-3 shrink-0 text-feedback-success" />
                )}
              </DropdownMenuItem>
            ))}
            <div className="my-1 border-t border-grey-100" />
            <DropdownMenuItem
              onClick={() => onCreateSpace(paper.title.slice(0, 40))}
              className="gap-2 text-[12px] font-medium text-grey-600"
            >
              <Plus className="size-3" />
              New project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={onResearch}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          Research this
          <ArrowUpRight className="size-3" />
        </button>
      </div>
      {showFeedback && onFeedback && (
        <div className="mt-2 flex items-center gap-1 border-t border-grey-100 pt-2">
          <span className="text-[10px] text-grey-400">Tune your feed:</span>
          <button
            onClick={() => onFeedback("more")}
            title="More like this"
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              feedbackSignal === "more"
                ? "bg-feedback-success-bg text-feedback-success"
                : "text-grey-500 hover:bg-grey-100 hover:text-ink",
            )}
          >
            <ThumbsUp className="size-3" />
            More
          </button>
          <button
            onClick={() => onFeedback("less")}
            title="Less like this"
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              feedbackSignal === "less"
                ? "bg-feedback-danger-bg text-feedback-danger"
                : "text-grey-500 hover:bg-grey-100 hover:text-ink",
            )}
          >
            <ThumbsDown className="size-3" />
            Less
          </button>
        </div>
      )}
    </article>
  );
}
