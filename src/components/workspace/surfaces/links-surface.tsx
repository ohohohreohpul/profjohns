"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ArrowSquareOut as ExternalLink, Link as Link2 } from "@phosphor-icons/react";
import { SpaceLayout } from "../space-layout";
import { useCanvasStore } from "@/store/canvas-store";
import type { PaperSource } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { staggerContainer, fadeUp } from "@/lib/motion-variants";

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export function LinksSurface() {
  const projectId = useSearchParams().get("project") ?? "";
  const sources = useCanvasStore((s) => s.sources);

  const byUrl = new Map<string, PaperSource>();
  for (const list of Object.values(sources)) {
    for (const s of list) {
      if (s.url && !byUrl.has(s.url)) byUrl.set(s.url, s);
    }
  }
  const links = [...byUrl.values()];

  return (
    <SpaceLayout active="links" projectId={projectId}>
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp}>
      <p className="mb-4 text-[13px] text-grey-500">
        {links.length} source link{links.length === 1 ? "" : "s"}
      </p>
      </motion.div>
      <motion.div variants={fadeUp}>
      {links.length === 0 ? (
        <p className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-grey-200 text-center text-[12px] text-grey-500">
          <Link2 className="size-6 text-grey-500" />
          Links from sources you find and keep appear here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-grey-200">
          {links.map((s, i) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-3 bg-paper px-4 py-2.5 transition-colors hover:bg-grey-50",
                i > 0 && "border-t border-grey-100",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-grey-100 text-grey-600">
                <ExternalLink className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-[12.5px] font-medium text-ink">
                  {s.title}
                </span>
                <span className="text-[10.5px] text-grey-500">
                  {domain(s.url!)} · {[s.authors, s.year].filter(Boolean).join(" · ")}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
      </motion.div>
      </motion.div>
    </SpaceLayout>
  );
}
