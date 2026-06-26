"use client";

import * as React from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { DocEditor } from "@/components/editor/doc-editor";

/**
 * The document on the Writing surface — the full-size view of the same TipTap
 * document edited inline on the canvas node (shared via the editor store keyed
 * by node id). Title + body; references render below it in the surface.
 */
export function WritingDocument({
  nodeId,
  direction,
}: {
  nodeId: string;
  direction: string;
}) {
  const ensureDoc = useCanvasStore((s) => s.ensureDoc);
  const doc = useCanvasStore((s) => s.docs[nodeId]);
  const updateDocTitle = useCanvasStore((s) => s.updateDocTitle);

  React.useEffect(() => {
    ensureDoc(nodeId, direction);
  }, [nodeId, direction, ensureDoc]);

  if (!doc) return null;

  return (
    <article className="mx-auto max-w-2xl rounded-lg border border-grey-200 bg-paper px-10 py-10 shadow-flat">
      <p className="text-[11px] uppercase tracking-wider text-grey-400">
        Working draft
      </p>
      <input
        value={doc.title}
        onChange={(e) => updateDocTitle(nodeId, e.target.value)}
        placeholder="Untitled"
        className="mb-6 mt-2 w-full bg-transparent font-serif tracking-display text-[2rem] font-semibold leading-tight text-ink outline-none placeholder:text-grey-300"
      />
      <DocEditor nodeId={nodeId} />
    </article>
  );
}
