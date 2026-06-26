"use client";

import * as React from "react";
import {
  Play,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
  Lightbulb,
  GitDiff as GitCompare,
  Tag,
} from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";
import { synthesizeSources, type Synthesis } from "@/lib/ai-client";
import { getModel } from "@/lib/models";

export function ProcessorNode({ id, data, selected }: CanvasNodeProps) {
  const sources = useNodeInputSources(id);
  const spendCredits = useCanvasStore((s) => s.spendCredits);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const synthesis = data.synthesis as Synthesis | undefined;

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
      const result = await synthesizeSources(sources);
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
      <div className="flex items-center gap-2 rounded-lg border border-grey-200 bg-grey-50/50 px-3 py-2">
        <span className="text-[11px] text-grey-500">
          {sources.length > 0
            ? `${sources.length} source${sources.length > 1 ? "s" : ""} connected`
            : "Connect sources above"}
        </span>
      </div>

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
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-2 text-[10px] text-red-600 animate-shake">
          <AlertCircle className="size-3 shrink-0" />
          {error}
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
              accent="text-amber-600"
            >
              {synthesis.contradictions.map((c, i) => (
                <div key={i} className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-2">
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
