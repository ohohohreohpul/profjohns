"use client";

import * as React from "react";
import { Binoculars as Telescope, Sparkle as Sparkles, PencilSimpleLine as PenLine, Quotes as Quote, Lock } from "@phosphor-icons/react";
import { SurfaceScaffold } from "../workspace-shell";
import { motion } from "motion/react";
import { staggerContainer, fadeUp } from "@/lib/motion-variants";

interface Archetype {
  key: string;
  name: string;
  role: string;
  icon: typeof Telescope;
  accent: string;
}

const ARCHETYPES: readonly Archetype[] = [
  {
    key: "scout",
    name: "Scout",
    role: "Finds relevant work — and deliberately seeks counter-sources and disconfirming evidence so you see both sides.",
    icon: Telescope,
    accent: "var(--color-node-explorer)",
  },
  {
    key: "synthesizer",
    name: "Synthesizer",
    role: "Reasons over your kept sources into structured claims, evidence, and contradictions — every point traced to a citation.",
    icon: Sparkles,
    accent: "var(--color-node-processor)",
  },
  {
    key: "stylist",
    name: "Stylist",
    role: "Writes in your dialect. Trained on your past papers to argue the way you argue and sound like you.",
    icon: PenLine,
    accent: "var(--color-node-writing)",
  },
  {
    key: "citationist",
    name: "Citationist",
    role: "Enforces your citation convention and verifies every reference actually exists — no fabricated citations.",
    icon: Quote,
    accent: "var(--color-node-reader)",
  },
];

export function AgentsSurface() {
  return (
    <SurfaceScaffold
      title="Agents"
      description="Your personal research agents — usable across the canvas"
    >
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp}>
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-grey-200 bg-paper px-4 py-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-grey-400" />
        <p className="text-[12px] leading-relaxed text-grey-500">
          These are the agents ProfJohns is being built around. Configuring and
          <span className="font-medium text-grey-700"> training them on your own writing</span>,
          plus running them in the background while you sleep, arrives with the
          accounts &amp; backend phase. See the roadmap in{" "}
          <span className="font-medium text-grey-700">docs/VISION.md</span>.
        </p>
      </div>
      </motion.div>

      <motion.div variants={fadeUp}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {ARCHETYPES.map((a) => {
          const Icon = a.icon;
          return (
            <div
              key={a.key}
              className="flex flex-col rounded-2xl border border-grey-200 bg-paper p-5 shadow-[0_1px_2px_rgba(21,23,28,0.04)]"
            >
              <span
                className="grid size-9 place-items-center rounded-xl"
                style={{
                  color: a.accent,
                  backgroundColor: `color-mix(in oklch, ${a.accent} 12%, white)`,
                }}
              >
                <Icon className="size-[18px]" />
              </span>
              <p className="mt-3 text-[14px] font-semibold tracking-tight text-ink">
                {a.name}
              </p>
              <p className="mt-1 flex-1 text-[12px] leading-relaxed text-grey-500">
                {a.role}
              </p>
              <button
                disabled
                className="mt-4 cursor-not-allowed rounded-lg border border-grey-200 px-3 py-1.5 text-[11px] font-medium text-grey-400"
              >
                Configure — coming soon
              </button>
            </div>
          );
        })}
      </div>
      </motion.div>
      </motion.div>
    </SurfaceScaffold>
  );
}
