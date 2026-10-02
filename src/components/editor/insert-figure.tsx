"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { ChartBar, ImageSquare } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDraftVisuals } from "./use-draft-visuals";
import type { CardDataFor } from "@/lib/board/schema";
import { figureMentionFor, figureNodeFor, listFigures, type BoardVisual } from "@/lib/draft-figures";

const MENU_LABEL_CHARS = 48;

function visualName(v: BoardVisual): string {
  const text = v.kind === "chart" ? (v.data as CardDataFor["chart"]).title || v.data.caption : v.data.caption || v.data.source?.title || "";
  const name = text.trim() || (v.kind === "chart" ? "Untitled chart" : "Untitled image");
  return name.length > MENU_LABEL_CHARS ? `${name.slice(0, MENU_LABEL_CHARS - 1)}…` : name;
}

/** Insert at the caret; with a figure selected, after it (never over it). */
function insertFigure(editor: Editor, visual: BoardVisual): void {
  const content = [figureNodeFor(visual), { type: "paragraph" }];
  const { selection } = editor.state;
  const chain = editor.chain().focus();
  (selection instanceof NodeSelection ? chain.insertContentAt(selection.to, content) : chain.insertContent(content)).run();
}

/** Toolbar menu: place one of the board's figures or charts at the caret. */
export function InsertFigureButton({ editor }: { readonly editor: Editor }) {
  const visuals = useDraftVisuals();
  // Opened on click: DocEditor stops pointerdown (so the canvas can't steal
  // the caret), which is the event the menu trigger would otherwise use.
  const [open, setOpen] = React.useState(false);
  const figures = listFigures(editor.getJSON());
  const boardVisuals = visuals;
  if (boardVisuals.length === 0 && figures.length === 0) return null;
  const placed = new Map(figures.map((f) => [f.cardId, f.number]));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink data-[state=open]:bg-grey-100 data-[state=open]:text-ink"
        >
          <ImageSquare className="size-3.5" />
          Figure
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72" onCloseAutoFocus={(e) => e.preventDefault()}>
        {figures.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-medium text-grey-600">Refer to a figure in the text</DropdownMenuLabel>
            {figures.map((f) => (
              <DropdownMenuItem
                key={`ref-${f.number}`}
                onSelect={() => editor.chain().focus().insertContent(figureMentionFor(f.cardId)).run()}
              >
                <span className="shrink-0 font-medium text-ink">Figure {f.number}</span>
                <span className="min-w-0 flex-1 truncate text-grey-600">{visualName({ id: f.cardId, kind: f.kind, data: f.data })}</span>
              </DropdownMenuItem>
            ))}
            {boardVisuals.length > 0 && <div role="separator" className="my-1 h-px bg-grey-200" />}
          </>
        )}
        {boardVisuals.length > 0 && (
          <DropdownMenuLabel className="text-xs font-medium text-grey-600">Place a figure from your canvas</DropdownMenuLabel>
        )}
        {boardVisuals.map((v) => {
          const Icon = v.kind === "chart" ? ChartBar : ImageSquare;
          const number = placed.get(v.id);
          return (
            <DropdownMenuItem
              key={v.id}
              onSelect={() => insertFigure(editor, v)}
            >
              <Icon className="size-4 shrink-0 text-grey-500" />
              <span className="min-w-0 flex-1 truncate">{visualName(v)}</span>
              {number && <span className="shrink-0 text-xs text-grey-600">Figure {number}</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
