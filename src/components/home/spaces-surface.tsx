"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash as Trash2, Clock, Stack as Layers, BookmarkSimple as Bookmark } from "@phosphor-icons/react";
import { SurfaceScaffold } from "@/components/workspace/workspace-shell";
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

const ACCENTS = [
  "var(--color-node-processor)",
  "var(--color-node-explorer)",
  "var(--color-node-reader)",
  "var(--color-node-writing)",
  "var(--color-node-media)",
];

export function SpacesSurface() {
  const router = useRouter();
  const projects = useWorkspaceStore((s) => s.projects);
  const addProject = useWorkspaceStore((s) => s.addProject);
  const addCanvas = useWorkspaceStore((s) => s.addCanvas);
  const removeProject = useWorkspaceStore((s) => s.removeProject);
  const updateProject = useWorkspaceStore((s) => s.updateProject);
  const pinnedSources = useWorkspaceStore((s) => s.pinnedSources);

  function open(id: string) {
    router.push(`/canvases?project=${id}`);
  }
  function create() {
    const id = addProject("Untitled project", "");
    addCanvas(id, "Main canvas");
    // Land in the project's Space (its boards), not straight inside a canvas.
    router.push(`/canvases?project=${id}`);
  }

  return (
    <SurfaceScaffold
      title="Spaces"
      description={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
    >
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
      >
        {projects.map((p, i) => (
          <motion.div key={p.id} variants={fadeUp}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => open(p.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(p.id);
              }
            }}
            className="group relative flex cursor-pointer flex-col rounded-2xl border border-grey-200 bg-paper p-5 shadow-[0_1px_2px_rgba(21,23,28,0.04)] transition-shadow hover:shadow-[0_12px_28px_-18px_rgba(21,23,28,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            <div className="mb-3 flex items-start justify-between">
              <span
                className="grid size-9 place-items-center rounded-xl"
                style={{
                  color: ACCENTS[i % ACCENTS.length],
                  background: `color-mix(in oklch, ${ACCENTS[i % ACCENTS.length]} 13%, white)`,
                }}
              >
                <Layers className="size-[18px]" />
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this project?")) removeProject(p.id);
                }}
                aria-label="Delete project"
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
                value={p.name}
                onCommit={(name) => updateProject(p.id, { name })}
                placeholder="Untitled project"
                className="w-full"
              />
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-grey-400">
              {p.direction || "No description"}
            </p>
            <div className="mt-4 flex items-center gap-3 text-[10px] text-grey-400">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {timeAgo(p.updatedAt)}
              </span>
              {p.itemCount != null && p.itemCount > 0 && (
                <span className="flex items-center gap-1">
                  <Layers className="size-3" />
                  {p.itemCount}
                </span>
              )}
              {(pinnedSources[p.id]?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Bookmark className="size-3" />
                  {(pinnedSources[p.id] ?? []).length} saved
                </span>
              )}
            </div>
          </div>
          </motion.div>
        ))}

        <motion.div variants={fadeUp}>
        <button
          onClick={create}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-grey-300 bg-grey-50/50 p-8 text-grey-400 transition-all hover:border-grey-400 hover:text-grey-600"
        >
          <Plus className="size-6" />
          <span className="text-[12px] font-medium">New project</span>
        </button>
        </motion.div>
      </motion.div>
    </SurfaceScaffold>
  );
}
