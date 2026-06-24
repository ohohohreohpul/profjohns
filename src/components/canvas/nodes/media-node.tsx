"use client";

import * as React from "react";
import { Upload, CircleNotch as Loader2, ImageBroken as ImageOff } from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { processImageFile } from "@/lib/image";
import { cn } from "@/lib/utils";

interface MediaData {
  src: string;
  width?: number;
  height?: number;
  caption?: string;
  alt?: string;
  credit?: string;
  name?: string;
}

export function MediaNode({ id, data, selected }: CanvasNodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const media = data.media as MediaData | undefined;

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function ingest(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await processImageFile(file);
      updateNodeData(id, {
        media: {
          src: img.src,
          width: img.width,
          height: img.height,
          name: img.name,
          credit: "Uploaded",
          caption: media?.caption ?? "",
        } satisfies MediaData,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load that image.");
    } finally {
      setBusy(false);
    }
  }

  function patchMedia(partial: Partial<MediaData>) {
    if (!media) return;
    updateNodeData(id, { media: { ...media, ...partial } });
  }

  return (
    <NodeShell
      id={id}
      kind="media"
      selected={selected}
      modelId={data.modelId}
      hideModel
      hideTarget
      className="w-80"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => ingest(e.target.files?.[0])}
      />

      {media?.src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.src}
            alt={media.alt || media.caption || "Uploaded image"}
            width={media.width}
            height={media.height}
            className="max-h-[260px] w-full rounded-lg bg-grey-50 object-contain"
          />
          <input
            value={media.caption ?? ""}
            onChange={(e) => patchMedia({ caption: e.target.value })}
            placeholder="Add a caption…"
            className="nodrag mt-2 w-full bg-transparent text-[12px] font-medium text-ink outline-none placeholder:text-grey-400"
          />
          <input
            value={media.alt ?? ""}
            onChange={(e) => patchMedia({ alt: e.target.value })}
            placeholder="Alt text (describe the image for accessibility)"
            className="nodrag mt-0.5 w-full bg-transparent text-[10.5px] text-grey-500 outline-none placeholder:text-grey-300"
          />
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-grey-400">
            <span className="truncate">{media.credit || media.name}</span>
            <button
              onClick={() => inputRef.current?.click()}
              className="nodrag rounded px-1.5 py-0.5 font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              Replace
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            ingest(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "nodrag flex h-[180px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
            dragOver
              ? "border-node-media bg-node-media/5"
              : "border-grey-200 hover:border-grey-300 hover:bg-grey-50/60",
          )}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin text-grey-400" />
          ) : error ? (
            <ImageOff className="size-5 text-red-400" />
          ) : (
            <Upload className="size-5 text-grey-400" />
          )}
          <span className="px-6 text-[11px] leading-relaxed text-grey-500">
            {busy
              ? "Processing…"
              : error
                ? error
                : "Drop an image here, or click to upload a figure, scan, or diagram"}
          </span>
        </button>
      )}
    </NodeShell>
  );
}
