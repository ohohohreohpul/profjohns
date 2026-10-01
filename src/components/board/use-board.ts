"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";
import { MemoryBoardRepository } from "@/lib/board/memory-repository";
import { SupabaseBoardRepository } from "@/lib/board/supabase-repository";
import { BoardRepositoryError, type BoardRepository } from "@/lib/board/repository";
import type { BoardSnapshot } from "@/lib/board/schema";

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

export type BoardState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly snapshot: BoardSnapshot; readonly repo: BoardRepository };

interface BoardRef {
  readonly boardId: string;
  readonly projectId: string;
  readonly boardName: string;
  readonly projectName: string;
}

/** Load a board from the server (source of truth), creating its walls once. */
export function useBoard(ref: BoardRef): BoardState & { reload: () => void } {
  const repo = useRepository();
  const [state, setState] = React.useState<BoardState>({ status: "loading" });
  const [nonce, setNonce] = React.useState(0);
  const { boardId, projectId, boardName, projectName } = ref;

  React.useEffect(() => {
    if (!repo || !boardId || !projectId) return;
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        await repo.ensureBoard({ boardId, projectId, boardName, projectName });
        await repo.ensureDefaultWalls(boardId, projectId);
        const snapshot = await repo.load(boardId);
        if (!cancelled) setState({ status: "ready", snapshot, repo });
      } catch (err: unknown) {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof BoardRepositoryError ? err.message : "Couldn't open this board. Try again.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, boardId, projectId, boardName, projectName, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
