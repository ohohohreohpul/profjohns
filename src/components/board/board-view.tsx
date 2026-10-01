"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, WarningCircle, X } from "@phosphor-icons/react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useCanvasStore, type ReaderInsight } from "@/store/canvas-store";
import { ReaderSurface } from "@/components/canvas/surfaces/reader-surface";
import { WritingSurface } from "@/components/canvas/surfaces/writing-surface";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import type { Card } from "@/lib/board/schema";
import type { PaperSource } from "@/lib/mock";
import type { ScreenedPaper } from "@/lib/scout";
import type { SourceProvider } from "@/lib/sources-client";
import { useRouter } from "next/navigation";
import { useBoard } from "./use-board";
import { WallColumn } from "./wall-column";
import { useBoardDraft } from "./use-board-draft";

interface BoardViewProps {
  readonly projectId: string;
  readonly boardId: string;
  /** Research question from the home page: becomes the Question, searched once. */
  readonly launchTopic?: string;
  readonly launchSources?: SourceProvider[];
}

/** The v2 board: titled walls of cards, loaded from the server. */
export function BoardView({ projectId, boardId, launchTopic, launchSources }: BoardViewProps) {
  const project = useWorkspaceStore((s) => s.projects.find((p) => p.id === projectId));
  const canvas = useWorkspaceStore((s) => s.canvases.find((c) => c.id === boardId));
  const projectName = project?.name ?? "Untitled project";
  const boardName = canvas?.name ?? "Board";
  const board = useBoard({ boardId, projectId, boardName, projectName });
  const openReader = useCanvasStore((s) => s.openReader);

  const snapshot = board.status === "ready" ? board.snapshot : null;
  const wallOf = React.useCallback(
    (kind: string) => snapshot?.walls.find((w) => w.kind === kind),
    [snapshot],
  );
  const papers = React.useMemo(
    () => (snapshot?.cards ?? []).filter((c): c is Card<"paper"> => c.kind === "paper").map((c) => c.data.paper),
    [snapshot],
  );
  const papersById = React.useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);
  const question =
    (snapshot?.cards.find((c) => c.kind === "question") as Card<"question"> | undefined)?.data.text ??
    project?.direction ??
    "";

  const { actions } = board;
  const router = useRouter();

  // Launch from the home page: write the Question, search once, then drop
  // the topic from the URL so a reload doesn't search again.
  const [autoRunTopic, setAutoRunTopic] = React.useState<string | undefined>();
  const launched = React.useRef(false);
  React.useEffect(() => {
    if (!snapshot || !launchTopic || launched.current) return;
    launched.current = true;
    const questionWall = snapshot.walls.find((w) => w.kind === "question");
    const hasQuestion = snapshot.cards.some((c) => c.kind === "question");
    void (async () => {
      if (questionWall && !hasQuestion) await actions.addCard(questionWall.id, "question", { text: launchTopic }, "top");
      setAutoRunTopic(launchTopic);
      router.replace(`/board?project=${encodeURIComponent(projectId)}&canvas=${encodeURIComponent(boardId)}`);
    })();
  }, [snapshot, launchTopic, actions, router, projectId, boardId]);
  const draft = useBoardDraft(snapshot, actions, question);
  const cardsById = React.useMemo(() => new Map((snapshot?.cards ?? []).map((c) => [c.id, c])), [snapshot]);

  // Reader "Make insight" -> an Insight card in the Insights wall.
  React.useEffect(() => {
    const insights = wallOf("insights");
    if (!insights) return;
    const sink = (i: ReaderInsight) =>
      void actions.addCard(insights.id, "insight", {
        type: i.type,
        statement: i.passage,
        quote: { text: i.passage, ...(i.page ? { page: i.page } : {}) },
        source: { paperId: i.paper.id, title: i.paper.title, authors: i.paper.authors, year: i.paper.year },
        origin: "study",
      });
    useCanvasStore.getState().setInsightSink(sink);
    return () => useCanvasStore.getState().setInsightSink(null);
  }, [wallOf, actions]);

  const addSearchResults = React.useCallback(
    async (screened: readonly ScreenedPaper[]) => {
      const sources = wallOf("sources");
      if (!sources) return;
      // Kept first so the most relevant papers sit at the top of the wall.
      const ordered = [...screened].sort((a, b) => Number(b.kept) - Number(a.kept) || (b.score ?? 0) - (a.score ?? 0));
      for (const { kept, score, why, cluster: _cluster, ...paper } of ordered) {
        await actions.addCard(sources.id, "paper", {
          paper,
          status: kept ? "kept" : "new",
          ...(score !== undefined ? { score: Math.round(score) } : {}),
          ...(why ? { why } : {}),
        });
      }
    },
    [wallOf, actions],
  );

  return (
    <main className="flex h-dvh flex-col bg-canvas">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-grey-200 bg-paper px-4">
        <Link
          href={`/canvases?project=${encodeURIComponent(projectId)}`}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          <span className="max-w-60 truncate">{projectName}</span>
        </Link>
        <span aria-hidden className="text-grey-300">/</span>
        <h1 className="font-display truncate text-sm font-semibold text-ink">{boardName}</h1>
      </header>

      {board.status === "loading" && (
        <div role="status" className="flex flex-1 items-center justify-center text-sm text-grey-600">
          Opening board…
        </div>
      )}

      {board.status === "error" && (
        <div role="alert" className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm rounded-xl border border-feedback-danger-border bg-feedback-danger-bg p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-feedback-danger">
              <WarningCircle className="size-4 shrink-0" />
              {board.message}
            </p>
            <button
              type="button"
              onClick={board.reload}
              className="mt-3 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-grey-800"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {snapshot && (
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 py-5">
          {snapshot.walls.map((wall) => (
            <WallColumn
              key={wall.id}
              wall={wall}
              walls={snapshot.walls}
              cards={snapshot.cards.filter((c) => c.wallId === wall.id).sort((a, b) => a.position - b.position)}
              actions={actions}
              onRead={(paper: PaperSource) => openReader(paper)}
              papersById={papersById}
              question={question}
              knownPapers={papers}
              onSearchResults={addSearchResults}
              themes={draft.themes}
              insightsByTheme={draft.insightsByTheme}
              cardsById={cardsById}
              onOpenDraft={draft.open}
              onStartDraft={() => void draft.startDraft()}
              allowedSources={launchSources}
              autoRunTopic={autoRunTopic}
            />
          ))}
        </div>
      )}

      {board.converted > 0 && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 flex max-w-xl -translate-x-1/2 items-center gap-3 rounded-xl border border-grey-200 bg-paper px-4 py-2.5 text-sm text-ink shadow-lift">
          <span>
            Moved {board.converted} item{board.converted === 1 ? "" : "s"} from your canvas board onto these walls. The original is kept.
          </span>
          <Link
            href={`/canvas?project=${encodeURIComponent(projectId)}&canvas=${encodeURIComponent(boardId)}`}
            className="shrink-0 font-medium underline underline-offset-2 hover:text-grey-700"
          >
            Open original
          </Link>
          <button type="button" aria-label="Dismiss" onClick={board.dismissConverted} className="rounded p-0.5 text-grey-600 hover:bg-grey-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {board.saveError && (
        <div role="alert" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-feedback-danger-border bg-feedback-danger-bg px-3 py-2 text-sm text-feedback-danger shadow-lift">
          <WarningCircle className="size-4 shrink-0" />
          {board.saveError}
          <button type="button" aria-label="Dismiss" onClick={board.dismissSaveError} className="ml-1 rounded p-0.5 hover:bg-paper/60">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {draft.openId && (
        <WritingSurface nodeId={draft.openId} direction={question} modelId={DEFAULT_MODEL_ID} onClose={draft.close} />
      )}

      <ReaderSurface />
    </main>
  );
}
