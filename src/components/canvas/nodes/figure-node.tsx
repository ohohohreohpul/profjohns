"use client";

import * as React from "react";
import { ImageSquare, WarningCircle } from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCardNode } from "./use-card-node";
import { FigureCardBody } from "@/components/board/cards/figure-card";
import { FigureError, isImageFile, storeFigureImage } from "@/lib/figure-storage";

/** An image (upload, paste, or captured from a PDF) with caption and citation. */
export function FigureNode({ id, data, selected }: CanvasNodeProps) {
  const { card, save, openPaper } = useCardNode(id, "figure", data);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!isImageFile(file)) {
      setError("That file isn't an image.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const image = await storeFigureImage(file);
      save({ image, caption: "", origin: "upload" });
    } catch (err: unknown) {
      setError(err instanceof FigureError ? err.message : "Couldn't add that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <NodeShell id={id} kind="figure" selected={selected} modelId={data.modelId} hideModel hideTarget onOpen={openPaper} className="w-72">
      {card ? (
        <div className="nodrag">
          <FigureCardBody data={card} onCaption={(caption) => save({ ...card, caption })} onOpenSource={openPaper} />
        </div>
      ) : (
        <div
          className="nodrag"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void upload(e.dataTransfer.files[0]);
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-grey-300 px-3 py-6 text-xs font-medium text-grey-600 transition-colors hover:border-grey-500 hover:text-ink disabled:opacity-60"
          >
            <ImageSquare className="size-5" />
            {busy ? "Adding image…" : "Choose or drop an image"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            aria-label="Add image to figure"
            className="hidden"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {error && (
            <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-feedback-danger">
              <WarningCircle className="size-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}
    </NodeShell>
  );
}
