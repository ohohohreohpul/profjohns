"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";
import { MemoryBoardRepository } from "@/lib/board/memory-repository";
import { SupabaseBoardRepository } from "@/lib/board/supabase-repository";
import { BoardRepositoryError, type BoardRepository } from "@/lib/board/repository";
import { parseCardData, type BoardSnapshot, type Card, type CardKind } from "@/lib/board/schema";
import { positionBetween } from "@/lib/board/position";

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
  /** Move to `wallId`, before the card `beforeId` (or to the end). */
  moveCard: (cardId: string, wallId: string, beforeId?: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
}

export type BoardState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly snapshot: BoardSnapshot };

const messageFor = (err: unknown, fallback: string) =>
  err instanceof BoardRepositoryError ? err.message : fallback;

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
  const snapshotRef = React.useRef<BoardSnapshot | null>(null);
  const { boardId, projectId, boardName, projectName } = ref;

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
        await repo.ensureBoard({ boardId, projectId, boardName, projectName });
        await repo.ensureDefaultWalls(boardId, projectId);
        const snapshot = await repo.load(boardId);
        if (!cancelled) setSnapshot(snapshot);
      } catch (err: unknown) {
        if (!cancelled) setState({ status: "error", message: messageFor(err, "Couldn't open this board. Try again.") });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, boardId, projectId, boardName, projectName, nonce, setSnapshot]);

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

  const actions: BoardActions = React.useMemo(
    () => ({
      async addCard(wallId, kind, data, where = "bottom") {
        const s = snapshotRef.current;
        if (!repo || !s) return null;
        const inWall = cardsIn(s, wallId);
        const position =
          where === "top"
            ? positionBetween(undefined, inWall[0]?.position)
            : positionBetween(inWall[inWall.length - 1]?.position, undefined);
        try {
          const card = await repo.addCard({ boardId, projectId, wallId, kind, position, data });
          const latest = snapshotRef.current ?? s;
          setSnapshot({ ...latest, cards: [...latest.cards, card] });
          setSaveError(null);
          return card;
        } catch (err: unknown) {
          setSaveError(messageFor(err, "Couldn't add that card."));
          return null;
        }
      },

      async updateCardData(cardId, data) {
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
          (s) => ({ ...s, cards: s.cards.map((c) => (c.id === cardId ? ({ ...c, data: parsed } as Card) : c)) }),
          async () => {
            await repo.updateCard(cardId, { data: parsed });
          },
          "Couldn't save that change.",
        );
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
          (b) => ({ ...b, cards: b.cards.map((c) => (c.id === cardId ? { ...c, wallId, position } : c)) }),
          async () => {
            await repo.updateCard(cardId, { wallId, position });
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
          () => repo.deleteCard(cardId),
          "Couldn't delete that card.",
        );
      },
    }),
    [repo, boardId, projectId, optimistic, setSnapshot],
  );

  return {
    ...state,
    actions,
    saveError,
    dismissSaveError: () => setSaveError(null),
    reload: () => setNonce((n) => n + 1),
  };
}
