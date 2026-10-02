"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";
import { MemoryBoardRepository } from "@/lib/board/memory-repository";
import { SupabaseBoardRepository } from "@/lib/board/supabase-repository";
import { BoardRepositoryError, type BoardRepository } from "@/lib/board/repository";
import { parseCardData, type BoardSnapshot, type Card, type CardKind } from "@/lib/board/schema";
import { positionBetween } from "@/lib/board/position";
import { convertBoardOnce } from "@/lib/board/run-conversion";
import { createKeyedQueue } from "@/lib/board/keyed-queue";
import { loadCanvasState } from "@/lib/db/repo";

/** The v1 board blob: this browser's copy first (it was authoritative), else the server's. */
async function readV1Board(boardId: string): Promise<unknown> {
  try {
    const raw = localStorage.getItem(`lattice-canvas-v1::${boardId}`);
    const local = raw ? (JSON.parse(raw) as { state?: { nodes?: unknown[] } }).state : undefined;
    if (local?.nodes?.length) return local;
  } catch {
    /* unreadable local copy: fall back to the server's */
  }
  return loadCanvasState(boardId);
}

/** One in-memory board store per page session (signed-out local dev/tests). */
let memoryRepo: MemoryBoardRepository | null = null;

function useRepository(): BoardRepository | null {
  const { user, enabled, loading } = useAuth();
  return React.useMemo(() => {
    if (!enabled) return (memoryRepo ??= new MemoryBoardRepository());
    if (loading || !user) return null;
    const sb = createClient();
    return sb ? new SupabaseBoardRepository(sb) : null;
  }, [enabled, loading, user]);
}

interface BoardRef {
  readonly boardId: string;
  readonly projectId: string;
  readonly boardName: string;
  readonly projectName: string;
}

export interface BoardActions {
  addCard: (wallId: string, kind: CardKind, data: unknown, where?: "top" | "bottom") => Promise<Card | null>;
  updateCardData: (cardId: string, data: unknown) => Promise<void>;
  /**
   * Update a card from its LATEST data (read at call time), so two quick
   * changes (e.g. two highlights) can't both start from the same old copy.
   */
  patchCardData: <K extends CardKind>(
    cardId: string,
    kind: K,
    change: (data: Card<K>["data"]) => Card<K>["data"],
  ) => Promise<void>;
  /** Move to `wallId`, before the card `beforeId` (or to the end). */
  moveCard: (cardId: string, wallId: string, beforeId?: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
}

export type BoardState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly snapshot: BoardSnapshot };

const messageFor = (err: unknown, fallback: string) => (err instanceof BoardRepositoryError ? err.message : fallback);

/**
 * A board loaded from the server (the source of truth). Mutations apply
 * immediately on screen, save in the background, and roll back with a
 * visible error if the save fails.
 */
export function useBoard(ref: BoardRef) {
  const repo = useRepository();
  const [state, setState] = React.useState<BoardState>({ status: "loading" });
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  /** Cards moved over from the old canvas board on this open (0 = none). */
  const [converted, setConverted] = React.useState(0);
  const snapshotRef = React.useRef<BoardSnapshot | null>(null);
  // One save at a time per card, in order: a slow earlier save must not
  // land after a later one (prod: a type change erased a title typed after it).
  const [saveInOrder] = React.useState(createKeyedQueue);
  const { boardId, projectId } = ref;
  // Names only label new rows; they arrive from the workspace store a moment
  // after mount and must not re-run the load (that raced into duplicates).
  const names = React.useRef({
    boardName: ref.boardName,
    projectName: ref.projectName,
  });
  names.current = { boardName: ref.boardName, projectName: ref.projectName };

  const setSnapshot = React.useCallback((next: BoardSnapshot) => {
    snapshotRef.current = next;
    setState({ status: "ready", snapshot: next });
  }, []);

  React.useEffect(() => {
    if (!repo || !boardId || !projectId) return;
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        await repo.ensureBoard({ boardId, projectId, ...names.current });
        await repo.ensureDefaultWalls(boardId, projectId);
        const { moved } = await convertBoardOnce(repo, { boardId, projectId }, () => readV1Board(boardId));
        if (!cancelled && moved > 0) setConverted(moved);
        const snapshot = await repo.load(boardId);
        if (!cancelled) setSnapshot(snapshot);
      } catch (err: unknown) {
        if (!cancelled)
          setState({
            status: "error",
            message: messageFor(err, "Couldn't open this board. Try again."),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, boardId, projectId, nonce, setSnapshot]);

  /** Apply `change` now; run `save`; restore the previous board if it fails. */
  const optimistic = React.useCallback(
    async (change: (s: BoardSnapshot) => BoardSnapshot, save: () => Promise<void>, failure: string) => {
      const before = snapshotRef.current;
      if (!before) return;
      const after = change(before);
      setSnapshot(after);
      try {
        await save();
        setSaveError(null);
      } catch (err: unknown) {
        // Undo just this change if nothing else happened meanwhile;
        // otherwise re-read the server rather than clobber later edits.
        if (snapshotRef.current === after) setSnapshot(before);
        else setNonce((n) => n + 1);
        setSaveError(messageFor(err, failure));
      }
    },
    [setSnapshot],
  );

  const cardsIn = (s: BoardSnapshot, wallId: string) =>
    s.cards.filter((c) => c.wallId === wallId).sort((a, b) => a.position - b.position);

  const actions: BoardActions = React.useMemo(() => {
    const updateCardData: BoardActions["updateCardData"] = async (cardId, data) => {
      const card = snapshotRef.current?.cards.find((c) => c.id === cardId);
      if (!repo || !card) return;
      let parsed: Card["data"];
      try {
        parsed = parseCardData(card.kind, data);
      } catch {
        setSaveError("That change isn't valid for this card.");
        return;
      }
      await optimistic(
        (s) => ({
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? ({ ...c, data: parsed } as Card) : c)),
        }),
        async () => {
          await saveInOrder(cardId, () => repo.updateCard(cardId, { data: parsed }));
        },
        "Couldn't save that change.",
      );
    };
    return {
      async addCard(wallId, kind, data, where = "bottom") {
        const s = snapshotRef.current;
        if (!repo || !s) return null;
        const inWall = cardsIn(s, wallId);
        const position =
          where === "top"
            ? positionBetween(undefined, inWall[0]?.position)
            : positionBetween(inWall[inWall.length - 1]?.position, undefined);
        try {
          const card = await repo.addCard({
            boardId,
            projectId,
            wallId,
            kind,
            position,
            data,
          });
          const latest = snapshotRef.current ?? s;
          setSnapshot({ ...latest, cards: [...latest.cards, card] });
          setSaveError(null);
          return card;
        } catch (err: unknown) {
          setSaveError(messageFor(err, "Couldn't add that card."));
          return null;
        }
      },

      updateCardData,

      async patchCardData(cardId, kind, change) {
        const card = snapshotRef.current?.cards.find((c) => c.id === cardId);
        if (!card || card.kind !== kind) return;
        await updateCardData(cardId, change(card.data as Card<typeof kind>["data"]));
      },

      async moveCard(cardId, wallId, beforeId) {
        const s = snapshotRef.current;
        if (!repo || !s) return;
        const others = cardsIn(s, wallId).filter((c) => c.id !== cardId);
        const at = beforeId ? others.findIndex((c) => c.id === beforeId) : -1;
        const position =
          at === -1
            ? positionBetween(others[others.length - 1]?.position, undefined)
            : positionBetween(others[at - 1]?.position, others[at].position);
        await optimistic(
          (b) => ({
            ...b,
            cards: b.cards.map((c) => (c.id === cardId ? { ...c, wallId, position } : c)),
          }),
          async () => {
            await saveInOrder(cardId, () => repo.updateCard(cardId, { wallId, position }));
          },
          "Couldn't move that card.",
        );
      },

      async deleteCard(cardId) {
        if (!repo) return;
        await optimistic(
          (s) => ({
            ...s,
            cards: s.cards.filter((c) => c.id !== cardId),
            links: s.links.filter((l) => l.fromCard !== cardId && l.toCard !== cardId),
          }),
          () => saveInOrder(cardId, () => repo.deleteCard(cardId)),
          "Couldn't delete that card.",
        );
      },
    };
  }, [repo, boardId, projectId, optimistic, setSnapshot, saveInOrder]);

  return {
    ...state,
    actions,
    saveError,
    dismissSaveError: () => setSaveError(null),
    converted,
    dismissConverted: () => setConverted(0),
    reload: () => setNonce((n) => n + 1),
  };
}
