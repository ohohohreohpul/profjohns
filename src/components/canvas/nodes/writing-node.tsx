"use client";

import * as React from "react";
import {
  ArrowsOutSimple as Maximize2,
  Books,
  Lightbulb,
  PlugsConnected,
  Sparkle as Sparkles,
} from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { DocEditor, DocFormatBar } from "@/components/editor/doc-editor";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";
import { extractText } from "@/lib/document";
import type { Synthesis } from "@/lib/ai-client";

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Claims from Synthesize nodes wired directly into this draft — the same
 *  set the editor's Compose step drafts from. */
function useIncomingClaimCount(nodeId: string): number {
  return useCanvasStore((s) => {
    const incomers = new Set(
      s.edges.filter((e) => e.target === nodeId).map((e) => e.source),
    );
    return s.nodes
      .filter((n) => incomers.has(n.id) && n.data.kind === "processor")
      .reduce(
        (sum, n) => sum + ((n.data.synthesis as Synthesis | undefined)?.claims.length ?? 0),
        0,
      );
  });
}

/**
 * Draft — the paper being written, shown on the canvas as a page: a serif
 * title and body you can type into directly, what feeds it (sources and
 * synthesis claims), and one way into the full editor. Formatting tools live
 * in the floating toolbar while the node is selected, so the page stays calm.
 */
export function WritingNode({ id, data, selected }: CanvasNodeProps) {
  const openSurface = useCanvasStore((s) => s.openSurface);
  const ensureDoc = useCanvasStore((s) => s.ensureDoc);
  const doc = useCanvasStore((s) => s.docs[id]);
  const updateDocTitle = useCanvasStore((s) => s.updateDocTitle);
  const direction = useCanvasStore((s) => s.direction);
  const sources = useNodeInputSources(id);
  const claimCount = useIncomingClaimCount(id);

  React.useEffect(() => {
    ensureDoc(id, direction);
  }, [id, direction, ensureDoc]);

  const words = React.useMemo(
    () => wordCount(extractText(doc?.content)),
    [doc?.content],
  );

  if (!doc) return null;

  const hasInputs = sources.length > 0 || claimCount > 0;
  // An empty draft with material wired in is one step from a first draft —
  // say so. Otherwise the action is simply to open the full editor.
  const canDraftWithAi = words === 0 && hasInputs;

  return (
    <NodeShell
      id={id}
      kind="writing"
      selected={selected}
      modelId={data.modelId}
      onOpen={() => openSurface(id)}
      toolbar={<DocFormatBar nodeId={id} />}
      className="!w-[560px]"
    >
      {/* Accent edge — the Draft's identity, per the node taxonomy. */}
      <div aria-hidden className="-mx-4 -mt-4 mb-5 h-0.5 rounded-t-[11px] bg-node-writing" />

      <p className="mb-1.5 text-[11px] font-medium tabular-nums text-grey-500">
        {words === 0 ? "Empty draft" : plural(words, "word")}
      </p>

      <DraftTitle value={doc.title} onChange={(title) => updateDocTitle(id, title)} />

      <div className="nodrag nowheel mt-3 max-h-[420px] overflow-y-auto">
        <DocEditor nodeId={id} compact showToolbar={false} />
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-grey-100 pt-3">
        <DraftInputs sourceCount={sources.length} claimCount={claimCount} />
        <button
          type="button"
          onClick={() => openSurface(id)}
          className="nodrag flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[11.5px] font-medium text-paper transition-colors hover:bg-grey-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          {canDraftWithAi ? (
            <>
              <Sparkles className="size-3.5" />
              Draft with AI
            </>
          ) : (
            <>
              <Maximize2 className="size-3.5" />
              Open editor
            </>
          )}
        </button>
      </footer>
    </NodeShell>
  );
}

/**
 * The title wraps and grows instead of scrolling sideways — academic titles
 * are long. Enter is swallowed so the title stays a single paragraph.
 */
function DraftTitle({
  value,
  onChange,
}: {
  value: string;
  onChange: (title: string) => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      placeholder="Untitled draft"
      aria-label="Draft title"
      className="nodrag block w-full resize-none overflow-hidden bg-transparent font-serif text-[24px] font-semibold leading-tight tracking-[-0.01em] text-ink outline-none placeholder:text-grey-400"
    />
  );
}

/** What this draft can cite — or how to give it something to cite. */
function DraftInputs({
  sourceCount,
  claimCount,
}: {
  sourceCount: number;
  claimCount: number;
}) {
  if (sourceCount === 0 && claimCount === 0) {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-grey-500">
        <PlugsConnected className="size-3.5 shrink-0" />
        <span className="truncate">Connect Sources or Synthesize to write with citations</span>
      </p>
    );
  }
  return (
    <p className="flex min-w-0 items-center gap-3 text-[11px] text-grey-600">
      {sourceCount > 0 && (
        <span className="flex items-center gap-1">
          <Books className="size-3.5 text-grey-500" />
          {plural(sourceCount, "source")}
        </span>
      )}
      {claimCount > 0 && (
        <span className="flex items-center gap-1">
          <Lightbulb className="size-3.5 text-grey-500" />
          {plural(claimCount, "claim")}
        </span>
      )}
    </p>
  );
}
