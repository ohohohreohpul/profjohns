"use client";

import * as React from "react";
import { BookOpen } from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * Library node — pulls this project's saved & uploaded sources (the project
 * library = Discover pins + Library uploads) onto the canvas as a producer, so
 * you can wire your library straight into Synthesize / Draft.
 */
export function LibraryNode({ id, data, selected }: CanvasNodeProps) {
  const projectId = useCanvasStore((s) => s.projectId);
  const setNodeSources = useCanvasStore((s) => s.setNodeSources);
  const pinnedMap = useWorkspaceStore((s) => s.pinnedSources);

  const sources = React.useMemo(
    () => pinnedMap[projectId] ?? [],
    [pinnedMap, projectId],
  );

  // Publish the library into the dataflow so connected nodes consume it.
  React.useEffect(() => {
    setNodeSources(id, sources);
  }, [id, sources, setNodeSources]);

  return (
    <NodeShell
      id={id}
      kind="library"
      selected={selected}
      modelId={data.modelId}
      hideModel
      hideTarget
      badge={
        sources.length > 0 ? (
          <span className="rounded-full bg-grey-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-grey-500">
            {sources.length}
          </span>
        ) : undefined
      }
      className="w-72"
    >
      {sources.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grey-200 px-3 py-4 text-center text-[11px] leading-relaxed text-grey-500">
          No saved sources yet. Upload or pin sources in this project&apos;s
          Library, and they appear here.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {sources.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-2 rounded-lg border border-grey-100 bg-grey-50/50 px-2.5 py-1.5"
              >
                <BookOpen className="mt-0.5 size-3 shrink-0 text-grey-500" />
                <div className="min-w-0">
                  <p className="line-clamp-1 text-[11.5px] font-medium text-ink">{s.title}</p>
                  <p className="truncate text-[10px] text-grey-500">
                    {[s.authors, s.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {sources.length > 5 && (
            <p className="mt-1.5 text-[10px] text-grey-500">
              + {sources.length - 5} more
            </p>
          )}
          <p className="mt-2 text-[10px] text-grey-500">
            {sources.length} source{sources.length === 1 ? "" : "s"} feed connected nodes
          </p>
        </>
      )}
    </NodeShell>
  );
}
