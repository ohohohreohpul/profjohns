/**
 * Retiring the board, once per board: claim it (board_version 2 -> 3), turn
 * its cards into canvas nodes to the right of what's already there, and wire
 * them up. The board's rows are left untouched (nothing is deleted).
 */
import { useCanvasStore } from "@/store/canvas-store";
import { remapCardIds } from "@/lib/draft-figures";
import type { BoardRepository } from "./repository";
import { boardToCanvas, importedSources, type ExistingCanvas } from "./to-canvas";
import type { PaperSource } from "@/lib/mock";

/** What's already on the canvas, so a board converted from it isn't duplicated. */
function existingOn(store: ReturnType<typeof useCanvasStore.getState>): ExistingCanvas {
  const paperIds = new Set<string>();
  const texts = new Set<string>();
  for (const n of store.nodes) {
    const paper = n.data.paper as PaperSource | undefined;
    if (n.data.kind === "paper" && paper?.id) paperIds.add(paper.id);
    if ((n.data.kind === "text" || n.data.kind === "block") && typeof n.data.text === "string") texts.add(n.data.text.trim());
  }
  const docContents = new Set(Object.values(store.docs).map((d) => JSON.stringify(d.content)));
  return { paperIds, texts, docContents, direction: store.direction || undefined };
}

/** New imported nodes start this far right of the existing canvas. */
const IMPORT_GAP_PX = 420;

export interface BoardImportResult {
  readonly moved: number;
  readonly skippedPapers: number;
}

export async function importBoardOnce(repo: BoardRepository, canvasId: string): Promise<BoardImportResult | null> {
  if (!(await repo.claimReturn(canvasId))) return null;
  try {
    const snapshot = await repo.load(canvasId);
    if (snapshot.cards.length === 0) return { moved: 0, skippedPapers: 0 };
    const store = useCanvasStore.getState();
    const right = store.nodes.reduce((m, n) => Math.max(m, n.position.x + (n.measured?.width ?? 300)), 0);
    const top = store.nodes.reduce((m, n) => Math.min(m, n.position.y), Number.POSITIVE_INFINITY);
    const out = boardToCanvas(snapshot, { x: right + IMPORT_GAP_PX, y: Number.isFinite(top) ? top : 80 }, existingOn(store));

    const ids = new Map<string, string>();
    // Cards the canvas already has: wires attach to the existing node.
    for (const [key, ref] of Object.entries(out.reused)) {
      const node =
        "paper" in ref
          ? store.nodes.find((n) => n.data.kind === "paper" && (n.data.paper as PaperSource | undefined)?.id === ref.paper)
          : store.nodes.find((n) => n.data.kind === "writing" && JSON.stringify(store.docs[n.id]?.content) === ref.doc);
      if (node) ids.set(key, node.id);
    }
    for (const node of out.nodes) {
      const id = useCanvasStore.getState().addNode(node.kind, node.position, node.data);
      ids.set(node.key, id);
      const papers = importedSources(node);
      if (papers.length > 0) useCanvasStore.getState().setNodeSources(id, papers);
    }
    useCanvasStore.setState((s) => {
      const docs = { ...s.docs };
      for (const [key, doc] of Object.entries(out.docs)) {
        // (Only drafts created by this import; reused ones keep their document.)
        const id = ids.get(key);
        if (id) docs[id] = { ...doc, content: remapCardIds(doc.content, ids) };
      }
      const highlights = { ...s.highlights };
      for (const [paperId, list] of Object.entries(out.highlights)) {
        const known = new Set((highlights[paperId] ?? []).map((h) => h.id));
        highlights[paperId] = [...(highlights[paperId] ?? []), ...list.filter((h) => !known.has(h.id))];
      }
      return { docs, highlights, ...(out.direction && !s.direction ? { direction: out.direction } : {}) };
    });
    useCanvasStore.getState().connectMany(
      out.links.flatMap((l) => {
        const source = ids.get(l.from);
        const target = ids.get(l.to);
        return source && target ? [{ source, target }] : [];
      }),
    );
    return { moved: out.nodes.length, skippedPapers: out.skippedPapers };
  } catch (err: unknown) {
    await repo.releaseReturn(canvasId).catch(() => undefined);
    throw err;
  }
}
