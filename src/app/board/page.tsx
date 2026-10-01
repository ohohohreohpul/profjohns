"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BoardView } from "@/components/board/board-view";
import { useWorkspaceStore } from "@/store/workspace-store";

function BoardPage() {
  const params = useSearchParams();
  const projectId = params.get("project") ?? "";
  const boardId = params.get("canvas") ?? "";

  // Names for the header come from the workspace store.
  React.useEffect(() => {
    useWorkspaceStore.persist.rehydrate();
  }, []);

  if (!projectId || !boardId) {
    return (
      <main className="flex h-dvh items-center justify-center bg-canvas p-6">
        <p className="text-sm text-grey-600">This link is missing its project or board. Open a board from your projects.</p>
      </main>
    );
  }
  return <BoardView projectId={projectId} boardId={boardId} />;
}

export default function Page() {
  return (
    <React.Suspense fallback={null}>
      <BoardPage />
    </React.Suspense>
  );
}
