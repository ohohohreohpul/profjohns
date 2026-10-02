"use client";

import * as React from "react";
import { Sparkle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCardNode } from "./use-card-node";
import { ThemeCardBody } from "@/components/board/cards/theme-card";
import { insightsAsSources, themeInsights, themesFromSynthesis } from "@/lib/canvas-cards";
import { synthesizeSources } from "@/lib/ai-client";
import { useCanvasStore } from "@/store/canvas-store";

/** Suggesting needs a few insights to group. */
const MIN_INSIGHTS_TO_SUGGEST = 2;
/** New suggested themes stack this far apart. */
const THEME_STACK_PX = 220;

/**
 * Group the canvas's insights into themes with AI (what Synthesize used to
 * do, now landing as Theme nodes wired to their evidence). The first theme
 * fills `themeId` (this empty theme); the rest are new Theme nodes below it.
 */
async function suggestThemes(themeId: string): Promise<number> {
  const state = useCanvasStore.getState();
  const { ids, sources } = insightsAsSources(state.nodes);
  const synthesis = await synthesizeSources(sources);
  const groups = themesFromSynthesis(ids, synthesis.themes);
  if (groups.length === 0) return 0;
  const self = state.nodes.find((n) => n.id === themeId);
  const origin = self?.position ?? { x: 80, y: 80 };
  const pairs: { source: string; target: string }[] = [];
  groups.forEach((g, i) => {
    let target = themeId;
    if (i === 0) {
      state.updateNodeData(themeId, { card: { name: g.name } });
    } else {
      target = state.addNode("theme", { x: origin.x, y: origin.y + i * THEME_STACK_PX }, { card: { name: g.name } });
    }
    pairs.push(...g.insightIds.map((source) => ({ source, target })));
  });
  useCanvasStore.getState().connectMany(pairs);
  return groups.length;
}

/** An argument the paper makes; insights connected into it are its evidence. */
export function ThemeNode({ id, data, selected }: CanvasNodeProps) {
  const { card, save } = useCardNode(id, "theme", data);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const insights = React.useMemo(() => themeInsights(nodes, edges, id), [nodes, edges, id]);
  const insightCount = React.useMemo(() => nodes.filter((n) => n.data.kind === "insight").length, [nodes]);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ text: string; error: boolean } | null>(null);
  const theme = card ?? { name: "" };
  const canSuggest = insights.length === 0 && !theme.name.trim() && insightCount >= MIN_INSIGHTS_TO_SUGGEST;

  async function onSuggest() {
    setBusy(true);
    setNote(null);
    try {
      const made = await suggestThemes(id);
      setNote(made === 0 ? { text: "No clear themes in these insights yet. Add more, or name a theme yourself.", error: false } : null);
    } catch (err: unknown) {
      setNote({ text: err instanceof Error ? err.message : "Couldn't suggest themes. Try again.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <NodeShell id={id} kind="theme" selected={selected} modelId={data.modelId} hideModel className="w-72">
      <div className="nodrag">
        <ThemeCardBody
          data={theme}
          insights={insights}
          onRename={(name) => save({ ...theme, name })}
          onDropInsight={() => undefined}
          emptyHint="Drop an insight on this theme, or connect one to it."
        />
        {canSuggest && (
          <button
            type="button"
            onClick={() => void onSuggest()}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-grey-300 px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:border-grey-500 hover:bg-grey-50 disabled:opacity-60"
          >
            {busy ? <CircleNotch className="size-3.5 animate-spin" /> : <Sparkle className="size-3.5" />}
            {busy ? "Grouping your insights…" : `Suggest themes from ${insightCount} insights`}
          </button>
        )}
        {note && (
          <p role={note.error ? "alert" : "status"} className={note.error ? "mt-1.5 flex items-center gap-1.5 text-xs text-feedback-danger" : "mt-1.5 text-xs text-grey-600"}>
            {note.error && <WarningCircle className="size-3.5 shrink-0" />}
            {note.text}
          </p>
        )}
      </div>
    </NodeShell>
  );
}
