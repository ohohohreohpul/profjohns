"use client";

import * as React from "react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { FIGURE_MENTION_NODE, figureNumbers, mentionLabel } from "@/lib/draft-figures";

/**
 * "Figure N" in running text. It points at a figure's card, not a number,
 * so it renumbers when figures move and reads "Figure ?" (flagged) if its
 * figure leaves the draft, instead of silently citing the wrong one.
 */
export const FigureMention = Node.create({
  name: FIGURE_MENTION_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { cardId: { default: null } };
  },

  parseHTML() {
    return [{ tag: "span[data-figure-mention]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", { "data-figure-mention": "", "data-card-id": HTMLAttributes.cardId ?? "" }];
  },

  // Plain-text copy has no document context for the number.
  renderText() {
    return "Figure";
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureMentionView);
  },
});

function useLabel(editor: NodeViewProps["editor"], cardId: string): string {
  const compute = React.useCallback(() => mentionLabel(cardId, figureNumbers(editor.getJSON())), [editor, cardId]);
  const [label, setLabel] = React.useState(compute);
  React.useEffect(() => {
    const update = () => setLabel(compute());
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor, compute]);
  return label;
}

function FigureMentionView({ node, editor, selected }: NodeViewProps) {
  const label = useLabel(editor, String(node.attrs.cardId ?? ""));
  const missing = label.endsWith("?");
  return (
    <NodeViewWrapper
      as="span"
      data-figure-mention=""
      title={missing ? "This figure is no longer in the draft. Place it again or remove this reference." : undefined}
      className={cn(
        "rounded underline underline-offset-2",
        // A live reference reads as text, marked as a reference by a dotted line.
        missing ? "bg-feedback-warning-bg px-0.5 text-feedback-warning decoration-wavy" : "text-ink decoration-grey-400 decoration-dotted",
        selected && "ring-2 ring-highlight",
      )}
    >
      {label}
    </NodeViewWrapper>
  );
}
