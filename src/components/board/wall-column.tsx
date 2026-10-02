"use client";

import * as React from "react";
import { Plus, ImageSquare, ChartBar } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Card, Wall } from "@/lib/board/schema";
import type { PaperSource } from "@/lib/mock";
import type { ScreenedPaper } from "@/lib/scout";
import type { SourceProvider } from "@/lib/sources-client";
import { WALL_META } from "./wall-meta";
import { BoardCard } from "./board-card";
import { CARD_DND_MIME } from "./cards/card-frame";
import { SourcesSearch } from "./sources-search";
import { ChartComposer } from "./cards/chart-composer";
import { chartFromTable } from "./cards/chart-card";
import type { BoardActions } from "./use-board";

interface WallColumnProps {
  readonly wall: Wall;
  /** This wall's cards, in order. */
  readonly cards: readonly Card[];
  readonly walls: readonly Wall[];
  readonly actions: BoardActions;
  readonly onRead: (paper: PaperSource) => void;
  readonly papersById: ReadonlyMap<string, PaperSource>;
  readonly question: string;
  readonly knownPapers: readonly PaperSource[];
  readonly onSearchResults: (papers: readonly ScreenedPaper[]) => Promise<void>;
  readonly themes: readonly Card<"theme">[];
  readonly insightsByTheme: ReadonlyMap<string, readonly Card<"insight">[]>;
  readonly cardsById: ReadonlyMap<string, Card>;
  readonly onOpenDraft: (cardId: string) => void;
  /** Create the board's Draft (Draft wall starter). */
  readonly onStartDraft: () => void;
  readonly allowedSources?: SourceProvider[];
  readonly autoRunTopic?: string;
  /** Image files dropped on or picked for this wall -> Figure cards. */
  readonly onAddImages: (wallId: string, files: File[], origin: "upload" | "paste") => void;
}

/** One titled column: its cards, its starting action, and a drop target. */
export function WallColumn(props: WallColumnProps) {
  const { wall, cards, walls, actions, onRead, papersById } = props;
  const meta = WALL_META[wall.kind];
  const Icon = meta.icon;
  const headingId = `wall-${wall.id}`;
  const listRef = React.useRef<HTMLUListElement>(null);
  // Index the dragged card would land at; null when nothing is over us.
  const [dropAt, setDropAt] = React.useState<number | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [composingChart, setComposingChart] = React.useState(false);
  const imageFiles = (list: FileList | null) => Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));

  function indexFromPointer(clientY: number): number {
    const items = listRef.current?.querySelectorAll<HTMLElement>(":scope > li") ?? [];
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return items.length;
  }

  const hasStarter = wall.kind === "question" || wall.kind === "sources";
  const showEmpty = cards.length === 0 && wall.kind !== "sources";
  const hasDraft = cards.some((c) => c.kind === "draft");

  return (
    <section
      aria-labelledby={headingId}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropAt(cards.length);
          return;
        }
        if (!e.dataTransfer.types.includes(CARD_DND_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropAt(indexFromPointer(e.clientY));
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null);
      }}
      onDrop={(e) => {
        const dropped = imageFiles(e.dataTransfer.files);
        if (dropped.length > 0) {
          e.preventDefault();
          setDropAt(null);
          props.onAddImages(wall.id, dropped, "upload");
          return;
        }
        const id = e.dataTransfer.getData(CARD_DND_MIME);
        const at = dropAt ?? cards.length;
        setDropAt(null);
        if (!id) return;
        e.preventDefault();
        // Land before the card under the drop line (skipping the dragged one).
        let before = cards[at];
        if (before?.id === id) before = cards[at + 1];
        void actions.moveCard(id, wall.id, before?.id);
      }}
      className={cn(
        "flex max-h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-grey-200 bg-paper shadow-flat transition-colors",
        dropAt !== null && "border-grey-400",
      )}
    >
      <div aria-hidden className="h-0.5 shrink-0" style={{ background: meta.accent }} />
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <Icon className="size-4 shrink-0" style={{ color: meta.accent }} weight="bold" />
        <h2 id={headingId} className="font-display min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {wall.title}
        </h2>
        <span className="rounded-full bg-grey-100 px-1.5 py-0.5 text-xs tabular-nums text-grey-600">{cards.length}</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {wall.kind === "sources" && (
          <SourcesSearch
            question={props.question}
            known={props.knownPapers}
            onResults={props.onSearchResults}
            allowedSources={props.allowedSources}
            autoRunTopic={props.autoRunTopic}
          />
        )}

        {wall.kind === "question" && cards.length === 0 && (
          <button
            type="button"
            onClick={() => void actions.addCard(wall.id, "question", { text: "" }, "top")}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-grey-800"
          >
            <Plus className="size-4" />
            Write your research question
          </button>
        )}

        {wall.kind === "themes" && (
          <button
            type="button"
            onClick={() => void actions.addCard(wall.id, "theme", { name: "" })}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-grey-300 px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-grey-500 hover:bg-grey-50"
          >
            <Plus className="size-4" />
            New theme
          </button>
        )}

        {wall.kind === "draft" && !hasDraft && (
          <button
            type="button"
            onClick={props.onStartDraft}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-grey-800"
          >
            <Plus className="size-4" />
            Start the draft
          </button>
        )}

        {showEmpty && (
          <div className="rounded-lg border border-dashed border-grey-300 px-3 py-4">
            <p className="text-sm font-medium text-ink">{meta.empty.what}</p>
            <p className="mt-1 text-xs leading-relaxed text-grey-600">
              {meta.empty.start}
            </p>
          </div>
        )}

        <ul ref={listRef} className={cn("space-y-2", (cards.length > 0 || hasStarter) && "mt-0")}>
          {cards.map((card, i) => (
            <li key={card.id} className="relative">
              {dropAt === i && <DropLine />}
              <BoardCard
                card={card}
                walls={walls}
                actions={actions}
                onRead={onRead}
                papersById={papersById}
                themes={props.themes}
                insightsByTheme={props.insightsByTheme}
                cardsById={props.cardsById}
                onOpenDraft={props.onOpenDraft}
              />
            </li>
          ))}
          {dropAt === cards.length && cards.length > 0 && (
            <li aria-hidden className="relative h-1">
              <DropLine />
            </li>
          )}
        </ul>

        {composingChart && (
          <div className="mt-2">
            <ChartComposer
              submitLabel="Make chart"
              onCancel={() => setComposingChart(false)}
              onSubmit={(table, suggestion) => {
                setComposingChart(false);
                void actions.addCard(wall.id, "chart", chartFromTable(table, suggestion));
              }}
            />
          </div>
        )}

        {wall.kind !== "question" && wall.kind !== "draft" && !composingChart && (
          <div className="mt-2 flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Add note"
              onClick={() => void actions.addCard(wall.id, "note", { text: "" })}
              className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              <Plus className="size-3.5" />
              Note
            </button>
            <button
              type="button"
              aria-label="Add image"
              onClick={() => imageInputRef.current?.click()}
              className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              <ImageSquare className="size-3.5" />
              Image
            </button>
            <button
              type="button"
              aria-label="Add chart"
              onClick={() => setComposingChart(true)}
              className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              <ChartBar className="size-3.5" />
              Chart
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              aria-label={`Add image to ${wall.title}`}
              className="hidden"
              onChange={(e) => {
                const files = imageFiles(e.target.files);
                e.target.value = "";
                if (files.length > 0) props.onAddImages(wall.id, files, "upload");
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function DropLine() {
  return <span aria-hidden className="absolute -top-1.5 left-0 right-0 h-0.5 rounded-full bg-highlight" />;
}
