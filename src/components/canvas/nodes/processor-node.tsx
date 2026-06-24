"use client";

import * as React from "react";
import { Play, CircleNotch as Loader2, WarningCircle as AlertCircle, Sparkle as Sparkles, MagicWand as Wand2, GitDiff as GitCompare, Funnel as ListFilter, Lightbulb } from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";
import { writeFromSources, editText } from "@/lib/ai-client";

const ACTIONS = [
  { label: "Summarize all", instruction: "Summarize all connected sources into a concise overview with key findings.", icon: ListFilter },
  { label: "Synthesize themes", instruction: "Synthesize common themes, patterns, and agreements across all connected sources.", icon: Sparkles },
  { label: "Find contradictions", instruction: "Identify contradictions, disagreements, and gaps between the connected sources.", icon: GitCompare },
  { label: "Extract key claims", instruction: "Extract the 5-7 most important claims from all connected sources.", icon: Lightbulb },
];

export function ProcessorNode({ id, data, selected }: CanvasNodeProps) {
  const sources = useNodeInputSources(id);
  const addNode = useCanvasStore((s) => s.addNode);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const spendCredits = useCanvasStore((s) => s.spendCredits);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodes = useCanvasStore((s) => s.nodes);
  const modelId = (data.modelId as string) ?? "claude-sonnet-4-6";

  const [prompt, setPrompt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastResultId, setLastResultId] = React.useState<string | null>(null);

  async function run(instruction?: string) {
    const instr = (instruction ?? prompt).trim();
    if (!instr || busy) return;
    if (sources.length === 0) {
      setError("Connect at least one source node.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const combinedText = sources
        .map((s) => `## ${s.title}\n${s.abstract ?? ""}`)
        .join("\n\n---\n\n");
      const answer = await editText(combinedText, instr);

      // Find the processor's position for placing the result
      const self = nodes.find((n) => n.id === id);
      const base = self?.position ?? { x: 0, y: 0 };
      const existingCount = nodes.length;

      // Create result node
      const resultId = addNode(
        "text",
        { x: base.x + 360, y: base.y + existingCount * 24 },
        { text: answer },
      );
      // Connect processor → result
      onConnect({
        source: id,
        sourceHandle: "out",
        target: resultId,
        targetHandle: "in",
      });
      setLastResultId(resultId);
      setPrompt("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <NodeShell
      id={id}
      kind="processor"
      selected={selected}
      modelId={data.modelId}
      onRun={() => run()}
      badge={
        sources.length > 0 ? (
          <span className="rounded-full bg-grey-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-grey-500">
            {sources.length}
          </span>
        ) : undefined
      }
      className="w-72"
    >
      {/* Source count */}
      <div className="flex items-center gap-2 rounded-lg border border-grey-200 bg-grey-50/50 px-3 py-2">
        <span className="text-[11px] text-grey-500">
          {sources.length > 0
            ? `${sources.length} source${sources.length > 1 ? "s" : ""} connected`
            : "Connect sources above"}
        </span>
      </div>

      {/* Quick actions */}
      <div className="nodrag mt-2.5 flex flex-wrap gap-1">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => run(a.instruction)}
              disabled={busy || sources.length === 0}
              className="flex items-center gap-1 rounded-full border border-grey-200 px-2.5 py-1 text-[10px] font-medium text-grey-600 transition-colors hover:border-grey-400 hover:bg-grey-50 disabled:opacity-40"
            >
              <Icon className="size-3" />
              {a.label}
            </button>
          );
        })}
      </div>

      {/* Custom prompt */}
      <div className="nodrag mt-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); }
          }}
          placeholder="Or write your own instruction…"
          rows={2}
          className="w-full resize-none rounded-lg border border-grey-200 bg-grey-50 px-2.5 py-1.5 text-[11px] text-ink outline-none placeholder:text-grey-400 focus:border-grey-300"
        />
        <button
          onClick={() => run()}
          disabled={busy || !prompt.trim() || sources.length === 0}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-1.5 text-[11px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              Run
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-2 text-[10px] text-red-600 animate-shake">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      )}
    </NodeShell>
  );
}