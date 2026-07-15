"use client";

import * as React from "react";
import { Books as Library, ChartBar as BarChart3, FileText, Plug, Lock } from "@phosphor-icons/react";
import { SurfaceScaffold } from "../workspace-shell";
import { motion } from "motion/react";
import { staggerContainer, fadeUp } from "@/lib/motion-variants";

interface Connector {
  key: string;
  name: string;
  role: string;
  icon: typeof Library;
}

const CONNECTORS: readonly Connector[] = [
  { key: "zotero", name: "Zotero", role: "Sync your reference library — import collections and push kept sources back.", icon: Library },
  { key: "statista", name: "Statista", role: "Pull statistics and charts to ground claims with data.", icon: BarChart3 },
  { key: "gdocs", name: "Google Docs", role: "Export drafts to Docs, or open a document as a source.", icon: FileText },
];

export function McpSurface() {
  return (
    <SurfaceScaffold
      title="Connectors"
      description="External tools and data via MCP"
    >
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp}>
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-grey-200 bg-paper px-4 py-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-grey-400" />
        <p className="text-[12px] leading-relaxed text-grey-500">
          Connectors let agents reach beyond the built-in indexes — reference
          managers, data sources, and document tools — over MCP. Wiring these up
          lands with the backend phase (see <span className="font-medium text-grey-700">docs/VISION.md</span>).
        </p>
      </div>
      </motion.div>

      <motion.div variants={fadeUp}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {CONNECTORS.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.key}
              className="flex flex-col rounded-2xl border border-grey-200 bg-paper p-5 shadow-[0_1px_2px_rgba(21,23,28,0.04)]"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-grey-100 text-grey-500">
                <Icon className="size-[18px]" />
              </span>
              <p className="mt-3 text-[14px] font-semibold tracking-tight text-ink">
                {c.name}
              </p>
              <p className="mt-1 flex-1 text-[12px] leading-relaxed text-grey-500">
                {c.role}
              </p>
              <p className="mt-4 text-[11px] font-medium text-grey-400">
                Not available yet
              </p>
            </div>
          );
        })}
      </div>
      </motion.div>
      </motion.div>
    </SurfaceScaffold>
  );
}
