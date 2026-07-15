"use client";

import * as React from "react";
import {
  MagnifyingGlass as Search,
  Books as LibraryIcon,
  Sparkle as Sparkles,
  MagicWand as Wand2,
  CircleNotch as Loader2,
  X,
  FileText,
  BookOpen,
  Link as Link2,
  Image as ImageIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  readAccountLibrary,
  collectTopics,
  buildCatalog,
  type AccountLibraryItem,
  type LibraryKind,
} from "@/lib/account-library";
import { categorizeLibrary } from "@/lib/ai-client";
import { cn } from "@/lib/utils";
import { LibraryCard } from "../library/library-card";
import { LibraryChat } from "../library/library-chat";
import { SemanticSearch } from "./semantic-search";
import { FigureSearch } from "./figure-search";
import { motion } from "motion/react";
import { staggerContainer, fadeUp } from "@/lib/motion-variants";

type KindFilter = "all" | LibraryKind;

const KIND_FILTERS: readonly { key: KindFilter; label: string; icon: Icon }[] = [
  { key: "all", label: "All", icon: LibraryIcon },
  { key: "document", label: "Documents", icon: FileText },
  { key: "source", label: "Sources", icon: BookOpen },
  { key: "link", label: "Links", icon: Link2 },
  { key: "media", label: "Media", icon: ImageIcon },
];

interface Chip {
  label: string;
  keys: Set<string>;
}

export function AccountLibrarySurface() {
  const projects = useWorkspaceStore((s) => s.projects);
  const canvases = useWorkspaceStore((s) => s.canvases);
  const pinnedSources = useWorkspaceStore((s) => s.pinnedSources);
  const pruneOrphans = useWorkspaceStore((s) => s.pruneOrphans);
  const wsHydrated = useWorkspaceStore((s) => s.hasHydrated);

  // Clean up orphaned data once hydrated — the store hard-gates pre-hydration
  // prunes, so the hydration dep is what makes this actually run.
  React.useEffect(() => {
    if (wsHydrated) pruneOrphans();
  }, [wsHydrated, pruneOrphans]);

  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [activeChip, setActiveChip] = React.useState<string | null>(null);
  const [aiCategories, setAiCategories] = React.useState<Chip[] | null>(null);
  const [catBusy, setCatBusy] = React.useState(false);
  const [catError, setCatError] = React.useState<string | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);

  const items = React.useMemo(
    () => readAccountLibrary(projects, canvases, pinnedSources),
    [projects, canvases, pinnedSources],
  );

  const projectCount = React.useMemo(
    () => new Set(items.flatMap((i) => i.projects.map((p) => p.id))).size,
    [items],
  );

  const kindCounts = React.useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const it of items) c[it.kind] = (c[it.kind] ?? 0) + 1;
    return c;
  }, [items]);

  // Filter chips: AI categories once generated, otherwise local topic tags.
  const chips: Chip[] = React.useMemo(() => {
    if (aiCategories) return aiCategories;
    return collectTopics(items)
      .slice(0, 12)
      .map((t) => ({
        label: t,
        keys: new Set(items.filter((i) => i.topics.includes(t)).map((i) => i.key)),
      }));
  }, [aiCategories, items]);

  const catalog = React.useMemo(() => buildCatalog(items), [items]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const chip = activeChip ? chips.find((c) => c.label === activeChip) : null;
    return items.filter((it) => {
      if (kind !== "all" && it.kind !== kind) return false;
      if (chip && !chip.keys.has(it.key)) return false;
      if (q) {
        const hay = [
          it.title,
          it.subtitle,
          it.snippet,
          ...it.projects.map((p) => p.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, kind, query, activeChip, chips]);

  async function autoCategorize() {
    if (catBusy || items.length === 0) return;
    setCatBusy(true);
    setCatError(null);
    try {
      const cats = await categorizeLibrary(catalog);
      setAiCategories(
        cats.map((c) => ({ label: c.category, keys: new Set(c.keys) })),
      );
      setActiveChip(null);
    } catch (e: unknown) {
      setCatError(e instanceof Error ? e.message : "Could not categorize.");
    } finally {
      setCatBusy(false);
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* Header */}
        <motion.header
          variants={fadeUp}
          initial="initial"
          animate="animate"
          className="shrink-0 border-b border-grey-200 bg-paper px-6 pb-4 pt-5"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-ink text-paper">
              <LibraryIcon className="size-4" />
            </span>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-ink">
                Readroom
              </h1>
              <p className="text-[12px] text-grey-500">
                Everything across your account ·{" "}
                <span className="tabular-nums">{items.length}</span> item
                {items.length === 1 ? "" : "s"} in{" "}
                <span className="tabular-nums">{projectCount}</span> project
                {projectCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              onClick={() => setChatOpen((v) => !v)}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
                chatOpen
                  ? "bg-grey-100 text-ink"
                  : "bg-ink text-paper hover:bg-grey-800",
              )}
            >
              <Sparkles className="size-3.5" />
              Ask your readroom
            </button>
          </div>

          {/* Toolbar — search + kind filters + categorize */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-grey-200 bg-paper px-3 py-1.5 focus-within:border-grey-300">
              <Search className="size-3.5 shrink-0 text-grey-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your readroom…"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-grey-500"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-grey-500 hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              {KIND_FILTERS.map((f) => {
                const Icon = f.icon;
                const count = kindCounts[f.key] ?? 0;
                const isActive = kind === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setKind(f.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      isActive
                        ? "bg-ink text-paper"
                        : "text-grey-500 hover:bg-grey-100 hover:text-ink",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {f.label}
                    <span
                      className={cn(
                        "tabular-nums",
                        isActive ? "text-grey-500" : "text-grey-500",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={autoCategorize}
              disabled={catBusy || items.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-grey-200 bg-paper px-2.5 py-1.5 text-[12px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink disabled:opacity-50"
            >
              {catBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              {aiCategories ? "Re-categorize" : "Auto-categorize"}
            </button>
          </div>

          {/* Filter chips — AI categories or local topics */}
          {(chips.length > 0 || catError) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {aiCategories && (
                <span className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wider text-grey-500">
                  <Sparkles className="size-3" />
                  Themes
                </span>
              )}
              {chips.map((c) => (
                <button
                  key={c.label}
                  onClick={() =>
                    setActiveChip((v) => (v === c.label ? null : c.label))
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    activeChip === c.label
                      ? "border-ink bg-ink text-paper"
                      : "border-grey-200 text-grey-600 hover:bg-grey-50 hover:text-ink",
                  )}
                >
                  {c.label}
                  <span className="ml-1 tabular-nums opacity-60">{c.keys.size}</span>
                </button>
              ))}
              {catError && (
                <span className="text-[11px] text-red-600">{catError}</span>
              )}
            </div>
          )}
        </motion.header>

        {/* Grid */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          className="min-h-0 flex-1 overflow-auto p-6"
        >
          <SemanticSearch />
          <FigureSearch />
          {items.length === 0 ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-grey-200 px-4 py-12 text-center text-[12px] text-grey-500">
              Nothing matches. Try a different search or filter.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {filtered.map((it) => (
                <LibraryCard key={it.key} item={it} />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {chatOpen && (
        <LibraryChat
          catalog={catalog}
          itemCount={items.length}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-grey-200 px-6 py-16 text-center">
      <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-grey-100 text-grey-600">
        <LibraryIcon className="size-6" />
      </span>
      <p className="text-[14px] font-semibold tracking-tight text-ink">
        Your readroom is empty
      </p>
      <p className="mx-auto mt-1.5 max-w-xs text-[12px] leading-relaxed text-grey-500">
        Documents you write, sources you keep, links you save, and media you add
        across any project collect here automatically.
      </p>
    </div>
  );
}
