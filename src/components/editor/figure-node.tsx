"use client";

import * as React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/canvas-store";
import type { CardDataFor } from "@/lib/board/schema";
import { FIGURE_NODE, captionBody, type VisualData, type VisualKind } from "@/lib/draft-figures";
import { FigureImage, figureAlt } from "@/components/board/cards/figure-card";
import { ChartLegend, ChartTable, ChartView } from "@/components/board/cards/chart-view";

/**
 * A numbered figure (image or chart) in the Draft. The node stores a copy of
 * its board card; while the board is open the live card wins and the copy is
 * refreshed, so captions edited on the board flow into the paper. Numbers
 * follow document order and update as figures are added, moved or removed.
 */
export const FigureRef = Node.create({
  name: FIGURE_NODE,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      cardId: { default: null },
      kind: { default: "figure" },
      data: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-figure-ref]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes({ "data-figure-ref": "" }, { "data-card-id": HTMLAttributes.cardId ?? "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureRefView);
  },
});

/** This figure's 1-based number: figure nodes before it, plus one. */
function useFigureNumber(editor: NodeViewProps["editor"], getPos: NodeViewProps["getPos"]): number {
  const compute = React.useCallback(() => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (typeof pos !== "number") return 0;
    let before = 0;
    editor.state.doc.descendants((n, p) => {
      if (p >= pos) return false;
      if (n.type.name === FIGURE_NODE) before++;
      return !n.isAtom;
    });
    return before + 1;
  }, [editor, getPos]);
  const [number, setNumber] = React.useState(0);
  React.useEffect(() => {
    const update = () => setNumber(compute());
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor, compute]);
  return number;
}

function FigureRefView({ node, updateAttributes, deleteNode, selected, editor, getPos }: NodeViewProps) {
  const number = useFigureNumber(editor, getPos);
  const { cardId, kind, data: stored } = node.attrs as { cardId: string; kind: VisualKind; data: VisualData | null };
  const board = useCanvasStore((s) => s.boardDraftContext);
  const live = board?.visuals?.find((v) => v.id === cardId);
  const data = live?.data ?? stored;
  // The board is open but the card is gone: keep the copy, say so.
  const orphaned = Boolean(board?.visuals) && !live;

  React.useEffect(() => {
    if (live && editor.isEditable && JSON.stringify(live.data) !== JSON.stringify(stored)) {
      updateAttributes({ data: live.data });
    }
  }, [live, stored, editor, updateAttributes]);

  if (!data) return <NodeViewWrapper as="figure" className="figure-ref" />;
  const body = captionBody(kind, data);

  return (
    <NodeViewWrapper
      as="figure"
      data-figure-ref=""
      data-card-id={cardId}
      className={cn(
        "figure-ref group/figure relative my-5 rounded-lg p-2 transition-shadow",
        selected && "ring-2 ring-highlight",
      )}
    >
      <div contentEditable={false} className="mx-auto max-w-md font-sans">
        {kind === "chart" ? (
          (data as CardDataFor["chart"]).type === "table" || (data as CardDataFor["chart"]).yColumns.length === 0 ? (
            <ChartTable data={data as CardDataFor["chart"]} caption={body || "Chart data"} />
          ) : (
            <>
              <ChartView data={data as CardDataFor["chart"]} />
              <ChartLegend data={data as CardDataFor["chart"]} />
            </>
          )
        ) : (
          <FigureImage image={(data as CardDataFor["figure"]).image} alt={figureAlt(data as CardDataFor["figure"])} />
        )}
        <figcaption className="mt-2 text-sm leading-relaxed text-grey-700">
          {number > 0 && <span className="font-semibold text-ink">Figure {number}.</span>}
          {body && ` ${body}`}
        </figcaption>
        {orphaned && (
          <p className="mt-1 text-xs text-grey-600">This card was removed from the board. The copy in your draft is kept.</p>
        )}
      </div>
      {editor.isEditable && (
        <button
          type="button"
          contentEditable={false}
          aria-label="Remove figure from draft"
          onClick={() => deleteNode()}
          className="absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-paper text-grey-600 opacity-0 shadow-sm transition-opacity hover:text-ink focus-visible:opacity-100 group-hover/figure:opacity-100"
        >
          <X className="size-4" />
        </button>
      )}
    </NodeViewWrapper>
  );
}
