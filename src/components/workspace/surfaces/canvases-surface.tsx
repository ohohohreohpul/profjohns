"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Graph as Network, Plus, Trash as Trash2, Clock, Stack as Layers } from "@phosphor-icons/react";
import { SpaceLayout } from "../space-layout";
import { useWorkspaceStore } from "@/store/workspace-store";
import { InlineEdit } from "@/components/ui/inline-edit";
import { motion } from "motion/react";
import { staggerContainer, fadeUp } from "@/lib/motion-variants";

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function CanvasesSurface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";

  const canvases = useWorkspaceStore((s) => s.canvases);
  const addCanvas = useWorkspaceStore((s) => s.addCanvas);
  const removeCanvas = useWorkspaceStore((s) => s.removeCanvas);
  const renameCanvas = useWorkspaceStore((s) => s.renameCanvas);

  const items = canvases
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function open(canvasId: string) {
    router.push(`/canvas?project=${projectId}&canvas=${canvasId}`);
  }

  function create() {
    const id = addCanvas(projectId);
    open(id);
  }

  return (
    <SpaceLayout active="canvases" projectId={projectId}>
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp}>
      <p className="mb-4 text-[13px] text-grey-500">
        {items.length} board{items.length === 1 ? "" : "s"} — one way to work on this project
      </p>
      </motion.div>
      <motion.div variants={fadeUp}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {items.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => open(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(c.id);
              }
            }}
            className="group relative flex cursor-pointer flex-col rounded-2xl border border-grey-200 bg-paper p-5 shadow-[0_1px_2px_rgba(21,23,28,0.04)] transition-shadow hover:shadow-[0_12px_28px_-18px_rgba(21,23,28,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            <div className="mb-3 flex items-start justify-between">
              <span className="grid size-8 place-items-center rounded-xl bg-grey-100 text-grey-600">
                <Network className="size-4" />
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this canvas?")) removeCanvas(c.id);
                }}
                aria-label="Delete canvas"
                className="grid size-6 place-items-center rounded-lg text-grey-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <InlineEdit
                value={c.name}
                onCommit={(name) => renameCanvas(c.id, name)}
                placeholder="Untitled canvas"
                className="w-full"
              />
            </div>
            <div className="mt-3 flex items-center gap-3 text-[10px] text-grey-400">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {timeAgo(c.updatedAt)}
              </span>
              {c.itemCount != null && c.itemCount > 0 && (
                <span className="flex items-center gap-1">
                  <Layers className="size-3" />
                  {c.itemCount}
                </span>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={create}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-grey-300 bg-grey-50/50 p-8 text-grey-400 transition-all hover:border-grey-400 hover:text-grey-600"
        >
          <Plus className="size-6" />
          <span className="text-[12px] font-medium">New canvas</span>
        </button>
      </div>
      </motion.div>
      </motion.div>
    </SpaceLayout>
  );
}
