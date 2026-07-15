"use client";

import * as React from "react";
import {
  Upload,
  CircleNotch as Loader2,
  ImageBroken as ImageOff,
  Sparkle as Sparkles,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { MagnifyingGlassPlus as SearchPlus } from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { describeImage } from "@/lib/ai-client";
import { clipEmbedImage } from "@/lib/clip";
import { saveFigure } from "@/lib/db/repo";
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
  /** AI vision description of the figure (feeds downstream nodes). */
  description?: string;
}

export function MediaNode({ id, data, selected }: CanvasNodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const projectId = useCanvasStore((s) => s.projectId);
  const media = data.media as MediaData | undefined;

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [describing, setDescribing] = React.useState(false);
  const [describeError, setDescribeError] = React.useState<string | null>(null);
  const [indexState, setIndexState] = React.useState<"idle" | "busy" | "done" | "off" | "error">("idle");
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function indexForSearch() {
    if (!media?.src || indexState === "busy") return;
    setIndexState("busy");
    try {
      const embedding = await clipEmbedImage(media.src);
      if (!embedding) {
        setIndexState("off"); // CLIP not configured
        return;
      }
      await saveFigure({
        id,
        projectId: projectId || undefined,
        src: media.src,
        caption: media.caption || media.description || "",
        embedding,
      });
      setIndexState("done");
    } catch {
      setIndexState("error");
    }
  }

  async function runDescribe() {
    if (!media?.src || describing) return;
    setDescribing(true);
    setDescribeError(null);
    try {
      const desc = await describeImage(
        media.src,
        media.caption || media.alt || undefined,
      );
      patchMedia({ description: desc });
    } catch (err: unknown) {
      setDescribeError(
        err instanceof Error ? err.message : "Could not analyze the image.",
      );
    } finally {
      setDescribing(false);
    }
  }

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
            className="nodrag mt-2 w-full bg-transparent text-[12px] font-medium text-ink outline-none placeholder:text-grey-500"
          />
          <input
            value={media.alt ?? ""}
            onChange={(e) => patchMedia({ alt: e.target.value })}
            placeholder="Alt text (describe the image for accessibility)"
            className="nodrag mt-0.5 w-full bg-transparent text-[10.5px] text-grey-500 outline-none placeholder:text-grey-500"
          />
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-grey-500">
            <span className="truncate">{media.credit || media.name}</span>
            <button
              onClick={() => inputRef.current?.click()}
              className="nodrag rounded px-1.5 py-0.5 font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              Replace
            </button>
          </div>

          {/* Vision — analyze the figure into a description that downstream
              nodes (Assistant, etc.) can read. */}
          <button
            onClick={runDescribe}
            disabled={describing}
            className="nodrag mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-grey-200 py-1.5 text-[11px] font-medium text-grey-700 transition-colors hover:border-grey-300 hover:bg-grey-50 disabled:opacity-40"
          >
            {describing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5 text-node-media" />
            )}
            {describing
              ? "Analyzing…"
              : media.description
                ? "Re-analyze figure"
                : "Describe with AI"}
          </button>

          {describeError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-red-600">
              <AlertCircle className="size-3 shrink-0" />
              {describeError}
            </p>
          )}

          {media.description && (
            <div className="nodrag nowheel mt-2 max-h-[160px] overflow-y-auto rounded-lg border border-grey-100 bg-grey-50/60 p-2.5">
              <p className="mb-1 flex items-center gap-1 text-[9.5px] font-medium uppercase tracking-wider text-grey-500">
                <Sparkles className="size-2.5" />
                AI description
              </p>
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-grey-600">
                {media.description}
              </p>
            </div>
          )}

          {/* CLIP index — make this figure findable by text/image search. */}
          <button
            onClick={indexForSearch}
            disabled={indexState === "busy"}
            className="nodrag mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-grey-200 py-1.5 text-[11px] font-medium text-grey-700 transition-colors hover:border-grey-300 hover:bg-grey-50 disabled:opacity-40"
          >
            {indexState === "busy" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <SearchPlus className="size-3.5 text-node-media" />
            )}
            {indexState === "busy"
              ? "Indexing…"
              : indexState === "done"
                ? "Indexed for search"
                : "Index for figure search"}
          </button>
          {indexState === "off" && (
            <p className="mt-1 text-[10px] text-grey-500">
              Figure search isn&apos;t set up (needs the Replicate CLIP key).
            </p>
          )}
          {indexState === "error" && (
            <p className="mt-1 flex items-center gap-1.5 text-[10px] text-red-600">
              <AlertCircle className="size-3 shrink-0" />
              Could not index this figure.
            </p>
          )}
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
            <Loader2 className="size-5 animate-spin text-grey-500" />
          ) : error ? (
            <ImageOff className="size-5 text-red-400" />
          ) : (
            <Upload className="size-5 text-grey-500" />
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
