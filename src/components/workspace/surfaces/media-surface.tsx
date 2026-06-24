"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ImageBroken as ImageOff } from "@phosphor-icons/react";
import { SpaceLayout } from "../space-layout";
import { useCanvasStore } from "@/store/canvas-store";
import { motion } from "motion/react";
import { staggerContainer, fadeUp } from "@/lib/motion-variants";

interface MediaItem {
  id: string;
  src: string;
  caption?: string;
  alt?: string;
  credit?: string;
}

export function MediaSurface() {
  const projectId = useSearchParams().get("project") ?? "";
  const nodes = useCanvasStore((s) => s.nodes);
  const items: MediaItem[] = nodes
    .filter((n) => n.data.kind === "media")
    .map((n) => {
      const m = (n.data as Record<string, unknown>).media as MediaItem | undefined;
      return m?.src ? { ...m, id: n.id } : null;
    })
    .filter((m): m is MediaItem => m !== null);

  return (
    <SpaceLayout active="media" projectId={projectId}>
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp}>
      <p className="mb-4 text-[13px] text-grey-500">
        {items.length} figure{items.length === 1 ? "" : "s"}, scan & diagram
      </p>
      </motion.div>
      <motion.div variants={fadeUp}>
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {items.map((m) => (
            <figure
              key={m.id}
              className="overflow-hidden rounded-xl border border-grey-200 bg-paper shadow-[0_1px_2px_rgba(21,23,28,0.04),0_12px_28px_-20px_rgba(21,23,28,0.3)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.src}
                alt={m.alt || m.caption || "Figure"}
                className="aspect-[4/3] w-full bg-grey-50 object-contain"
              />
              <figcaption className="px-3 py-2">
                <p className="line-clamp-2 text-[12px] font-medium text-ink">
                  {m.caption || "Untitled figure"}
                </p>
                {m.credit && (
                  <p className="mt-0.5 truncate text-[10px] text-grey-400">{m.credit}</p>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      </motion.div>
      </motion.div>
    </SpaceLayout>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-grey-200 text-center">
      <ImageOff className="size-6 text-grey-300" />
      <p className="text-[13px] font-medium text-grey-500">No media yet</p>
      <p className="max-w-[320px] text-[12px] text-grey-400">
        Drop an image onto the canvas, or pop a figure out of a source. It will
        appear here.
      </p>
    </div>
  );
}
