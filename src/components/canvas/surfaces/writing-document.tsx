"use client";

import * as React from "react";
import { TextHTwo as Heading2, Paragraph as Pilcrow, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/canvas-store";
import type { Block } from "@/lib/document";

function focusEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * Block-based editor for the Writing surface. Documents live in the canvas
 * store keyed by node id, so edits persist across closing/reopening the
 * surface. Blocks use uncontrolled contentEditable to keep the caret stable.
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
  const updateBlockText = useCanvasStore((s) => s.updateBlockText);
  const setBlockType = useCanvasStore((s) => s.setBlockType);
  const addBlockAfter = useCanvasStore((s) => s.addBlockAfter);
  const removeBlock = useCanvasStore((s) => s.removeBlock);

  const [focusId, setFocusId] = React.useState<string | null>(null);

  React.useEffect(() => {
    ensureDoc(nodeId, direction);
  }, [nodeId, direction, ensureDoc]);

  if (!doc) return null;

  function handleEnter(block: Block) {
    const newId = addBlockAfter(nodeId, block.id, "paragraph");
    setFocusId(newId);
  }

  function addParagraphAtEnd() {
    const last = doc?.blocks[doc.blocks.length - 1];
    if (!last) return;
    const newId = addBlockAfter(nodeId, last.id, "paragraph");
    setFocusId(newId);
  }

  function handleRemove(block: Block) {
    const index = doc.blocks.findIndex((b) => b.id === block.id);
    if (index <= 0) return;
    const prev = doc.blocks[index - 1];
    removeBlock(nodeId, block.id);
    setFocusId(prev.id);
  }

  return (
    <article className="mx-auto max-w-2xl rounded-lg border border-grey-200 bg-paper px-10 py-10 shadow-flat">
      <p className="text-[11px] uppercase tracking-wider text-grey-400">
        Working draft
      </p>
      <input
        value={doc.title}
        onChange={(e) => updateDocTitle(nodeId, e.target.value)}
        placeholder="Untitled"
        className="mt-2 w-full bg-transparent font-serif tracking-display text-[2rem] font-semibold leading-tight text-ink outline-none placeholder:text-grey-300"
      />

      <div className="mt-8 space-y-1">
        {doc.blocks.map((block) => (
          <EditableBlock
            key={block.id}
            block={block}
            autoFocus={focusId === block.id}
            onChange={(text) => updateBlockText(nodeId, block.id, text)}
            onEnter={() => handleEnter(block)}
            onRemove={() => handleRemove(block)}
            onToggleType={() =>
              setBlockType(
                nodeId,
                block.id,
                block.type === "heading" ? "paragraph" : "heading",
              )
            }
          />
        ))}
      </div>

      <button
        onClick={addParagraphAtEnd}
        className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left text-sm text-grey-400 transition-colors hover:bg-grey-50 hover:text-ink"
      >
        <Plus className="size-3.5" />
        Add a paragraph — or just start typing
      </button>
    </article>
  );
}

interface EditableBlockProps {
  block: Block;
  autoFocus: boolean;
  onChange: (text: string, html: string) => void;
  onEnter: () => void;
  onRemove: () => void;
  onToggleType: () => void;
}

function EditableBlock({
  block,
  autoFocus,
  onChange,
  onEnter,
  onRemove,
  onToggleType,
}: EditableBlockProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Seed the DOM once (rich html if present, else plain text). We deliberately
  // do not resync on every change, which would reset the caret mid-typing.
  React.useEffect(() => {
    if (!ref.current) return;
    if (block.html) {
      ref.current.innerHTML = block.html;
    } else if (ref.current.innerText !== block.text) {
      ref.current.innerText = block.text;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (autoFocus && ref.current) focusEnd(ref.current);
  }, [autoFocus]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter();
    } else if (
      e.key === "Backspace" &&
      (e.currentTarget.innerText === "" || e.currentTarget.innerText === "\n")
    ) {
      e.preventDefault();
      onRemove();
    }
  }

  const isHeading = block.type === "heading";

  return (
    <div className="group relative -ml-8 flex items-start gap-2 pl-8">
      <button
        type="button"
        onClick={onToggleType}
        aria-label={isHeading ? "Make paragraph" : "Make heading"}
        className="absolute left-0 top-1 grid size-6 place-items-center rounded text-grey-300 opacity-0 transition-opacity hover:bg-grey-100 hover:text-ink group-hover:opacity-100"
      >
        {isHeading ? (
          <Pilcrow className="size-3.5" />
        ) : (
          <Heading2 className="size-3.5" />
        )}
      </button>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={isHeading ? "Heading" : "Write…"}
        onInput={(e) =>
          onChange(e.currentTarget.innerText, e.currentTarget.innerHTML)
        }
        onKeyDown={handleKeyDown}
        className={cn(
          "editor-block flex-1 rounded-sm outline-none focus:bg-grey-50",
          isHeading
            ? "py-1 text-lg font-semibold tracking-tight text-ink"
            : "py-0.5 font-serif text-[16px] leading-[1.75] text-grey-800",
        )}
      />
    </div>
  );
}
