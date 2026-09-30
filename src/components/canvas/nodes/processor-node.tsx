"use client";

import * as React from "react";
import {
  Play,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
  Lightbulb,
  GitDiff as GitCompare,
  Tag,
  ArrowRight,
  PlugsConnected,
} from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { AgentPicker, useNodeAgent } from "@/components/canvas/agent-picker";
import { agentSystemPrompt } from "@/lib/agents";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";
import { synthesizeSources, type Synthesis } from "@/lib/ai-client";
import { getModel } from "@/lib/models";

export function ProcessorNode({ id, data, selected }: CanvasNodeProps) {
  const sources = useNodeInputSources(id);
  const spendCredits = useCanvasStore((s) => s.spendCredits);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const synthesis = data.synthesis as Synthesis | undefined;
  // Claims only reach a Draft wired directly from this node (Compose reads
  // its direct incomers), so tell the user whether that link exists.
  const feedsDraft = useCanvasStore((s) =>
    s.edges.some(
      (e) =>
        e.source === id &&
        s.nodes.find((n) => n.id === e.target)?.data.kind === "writing",
    ),
  );

  // Runs from the Synthesizer agent (overridable).
  const agent = useNodeAgent(id, "synthesizer");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    if (busy) return;
    if (sources.length === 0) {
      setError("Connect at least one source node.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await synthesizeSources(
        sources,
        agent ? agentSystemPrompt(agent) : undefined,
        (data.modelId as string) ?? undefined,
      );
      updateNodeData(id, { synthesis: result });
      spendCredits(getModel((data.modelId as string) ?? "").creditsPerRun);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Synthesis failed.");
    } finally {
      setBusy(false);
    }
  }

  const hasResult = !!synthesis && synthesis.claims.length + synthesis.contradictions.length > 0;

  return (
    <NodeShell
      id={id}
      kind="processor"
      selected={selected}
      modelId={data.modelId}
      onRun={run}
      badge={
        sources.length > 0 ? (
          <span className="rounded-full bg-grey-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-grey-500">
            {sources.length}
          </span>
        ) : undefined
      }
      className="w-80"
    >
      <div className="mb-2">
        <AgentPicker nodeId={id} archetype="synthesizer" />
      </div>

      {sources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-grey-300 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
            <PlugsConnected className="size-3.5 shrink-0" />
            Connect sources to this node
          </p>
          <p className="mt-1 text-[11px] leading-snug text-grey-600">
            Drag from the dot on the right of a Sources or Paper node to the dot
            on this node&apos;s left. Synthesize reads them together and pulls out
            shared claims, contradictions, and themes.
          </p>
        </div>
      ) : (
        <SourceList sources={sources} />
      )}

      <button
        onClick={run}
        disabled={busy || sources.length === 0}
        className="nodrag mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-1.5 text-[11px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Synthesizing…
          </>
        ) : (
          <>
            <Play className="size-3.5" />
            {hasResult ? "Re-synthesize" : "Synthesize sources"}
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-feedback-danger-border bg-feedback-danger-bg/50 px-2.5 py-2 text-[10px] text-feedback-danger animate-shake">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      )}

      {synthesis && hasResult && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-grey-600">
          <ArrowRight className="size-3.5 shrink-0" />
          {feedsDraft
            ? "These claims feed the connected Draft."
            : "Connect this node to a Draft to write from these claims."}
        </p>
      )}

      {synthesis && hasResult && (
        <div className="nodrag nowheel mt-2.5 max-h-80 space-y-3 overflow-y-auto pr-0.5">
          {synthesis.claims.length > 0 && (
            <Section icon={Lightbulb} label="Claims" count={synthesis.claims.length}>
              {synthesis.claims.map((c, i) => (
                <div key={i} className="rounded-lg border border-grey-100 bg-grey-50/40 p-2">
                  <p className="text-[11.5px] leading-snug text-ink">{c.claim}</p>
                  {c.evidence && (
                    <p className="mt-1 text-[10px] leading-snug text-grey-500">{c.evidence}</p>
                  )}
                  <SourceChips nums={c.sources} sources={sources} />
                </div>
              ))}
            </Section>
          )}

          {synthesis.contradictions.length > 0 && (
            <Section
              icon={GitCompare}
              label="Contradictions"
              count={synthesis.contradictions.length}
              accent="text-feedback-warning"
            >
              {synthesis.contradictions.map((c, i) => (
                <div key={i} className="rounded-lg border border-feedback-warning-border/70 bg-feedback-warning-bg/40 p-2">
                  <p className="text-[11.5px] leading-snug text-ink">{c.claim}</p>
                  {c.note && (
                    <p className="mt-1 text-[10px] leading-snug text-grey-500">{c.note}</p>
                  )}
                  <SourceChips nums={c.sources} sources={sources} />
                </div>
              ))}
            </Section>
          )}

          {synthesis.themes.length > 0 && (
            <Section icon={Tag} label="Themes" count={synthesis.themes.length}>
              <div className="flex flex-wrap gap-1">
                {synthesis.themes.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-grey-200 px-2 py-0.5 text-[10px] font-medium text-grey-600"
                  >
                    {t.theme}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </NodeShell>
  );
}

const SOURCE_PREVIEW_COUNT = 3;

/** The papers this node will read — titles, not just a count. */
function SourceList({ sources }: { sources: ReturnType<typeof useNodeInputSources> }) {
  const shown = sources.slice(0, SOURCE_PREVIEW_COUNT);
  const rest = sources.length - shown.length;
  return (
    <div className="rounded-lg border border-grey-200 px-3 py-2">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-grey-500">
        Reading {sources.length} source{sources.length === 1 ? "" : "s"}
      </p>
      <ul className="space-y-0.5">
        {shown.map((s) => (
          <li key={s.id} className="truncate text-[11px] text-grey-700" title={s.title}>
            {s.title}
          </li>
        ))}
      </ul>
      {rest > 0 && <p className="mt-0.5 text-[10.5px] text-grey-500">and {rest} more</p>}
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  count,
  accent,
  children,
}: {
  icon: typeof Lightbulb;
  label: string;
  count: number;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className={`mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider ${accent ?? "text-grey-400"}`}>
        <Icon className="size-3" />
        {label}
        <span className="tabular-nums text-grey-300">{count}</span>
      </p>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function SourceChips({
  nums,
  sources,
}: {
  nums: number[];
  sources: ReturnType<typeof useNodeInputSources>;
}) {
  if (nums.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {nums.map((n) => {
        const src = sources[n - 1];
        return (
          <span
            key={n}
            title={src?.title}
            className="rounded bg-grey-100 px-1.5 py-0.5 text-[9.5px] font-medium tabular-nums text-grey-600"
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}
