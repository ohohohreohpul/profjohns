"use client";

import * as React from "react";
import {
  ArrowSquareOut as ExternalLink,
  BookOpen,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
  ArrowClockwise as RotateCw,
  ArrowRight,
} from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { fetchLinkPreview, previewToSource, hostOf } from "@/lib/link-client";
import type { PaperSource } from "@/lib/mock";

type Status = "empty" | "loading" | "ready" | "error";

/**
 * Link node — bring any web page onto the canvas. Paste a URL, get a FigJam-style
 * preview card, then read it (in-app Reader) and feed it downstream as a citable
 * web source. Producer: publishes its single source into the dataflow.
 */
export function LinkNode({ id, data, selected }: CanvasNodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeSources = useCanvasStore((s) => s.setNodeSources);
  const openReader = useCanvasStore((s) => s.openReader);

  const source = data.source as PaperSource | undefined;
  const image = data.image as string | undefined;
  const favicon = data.favicon as string | undefined;
  const seedUrl = (data.url as string | undefined) ?? "";

  const [draft, setDraft] = React.useState(seedUrl);
  const [status, setStatus] = React.useState<Status>(source ? "ready" : "empty");
  const [error, setError] = React.useState<string | null>(null);

  // Publish the web source into the dataflow whenever it is set.
  React.useEffect(() => {
    if (source) setNodeSources(id, [source]);
  }, [id, source, setNodeSources]);

  const load = React.useCallback(
    async (rawUrl: string) => {
      const url = rawUrl.trim();
      if (!url) return;
      setStatus("loading");
      setError(null);
      try {
        const preview = await fetchLinkPreview(url);
        const next = previewToSource(preview);
        updateNodeData(id, {
          source: next,
          image: preview.image ?? undefined,
          favicon: preview.favicon ?? undefined,
          url: next.url,
        });
        setStatus("ready");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not load this link.");
        setStatus("error");
      }
    },
    [id, updateNodeData],
  );

  // Auto-fetch when the node is created pre-seeded with a URL (e.g. dropped).
  React.useEffect(() => {
    if (seedUrl && !source) void load(seedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NodeShell
      id={id}
      kind="link"
      selected={selected}
      modelId={data.modelId}
      hideModel
      hideTarget
      onOpen={source?.url ? () => openReader(source) : undefined}
      className="w-72"
    >
      {status === "ready" && source ? (
        <ReadyCard
          source={source}
          image={image}
          favicon={favicon}
          onRead={() => openReader(source)}
          onRefetch={() => load(source.url ?? seedUrl)}
        />
      ) : status === "loading" ? (
        <div className="flex items-center gap-2 rounded-lg border border-grey-100 bg-grey-50/50 px-3 py-4 text-[11.5px] text-grey-500">
          <Loader2 className="size-3.5 animate-spin" />
          Fetching preview…
        </div>
      ) : (
        <UrlEntry
          value={draft}
          onChange={setDraft}
          onSubmit={() => load(draft)}
          error={status === "error" ? error : null}
        />
      )}
    </NodeShell>
  );
}

interface ReadyCardProps {
  source: PaperSource;
  image?: string;
  favicon?: string;
  onRead: () => void;
  onRefetch: () => void;
}

function ReadyCard({ source, image, favicon, onRead, onRefetch }: ReadyCardProps) {
  const host = hostOf(source.url ?? source.venue);
  return (
    <>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="mb-2 h-28 w-full rounded-lg border border-grey-100 object-cover"
          loading="lazy"
        />
      )}
      <div className="flex items-center gap-1.5">
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" className="size-3.5 rounded-[3px]" loading="lazy" />
        ) : (
          <ExternalLink className="size-3 text-grey-400" />
        )}
        <span className="truncate text-[10px] font-medium uppercase tracking-wide text-grey-400">
          {host}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
        {source.title}
      </p>
      {source.abstract && (
        <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-grey-600">
          {source.abstract}
        </p>
      )}
      <div className="nodrag mt-2.5 flex items-center gap-1">
        <button
          onClick={onRead}
          className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[10px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink"
        >
          <BookOpen className="size-3" />
          Read
        </button>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <ExternalLink className="size-3" />
          Open
        </a>
        <button
          onClick={onRefetch}
          title="Re-fetch preview"
          className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <RotateCw className="size-3" />
        </button>
      </div>
    </>
  );
}

interface UrlEntryProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
}

function UrlEntry({ value, onChange, onSubmit, error }: UrlEntryProps) {
  return (
    <div className="nodrag">
      <div className="flex items-center gap-1.5 rounded-lg border border-grey-200 bg-paper px-2.5 py-1.5 focus-within:border-grey-300">
        <ExternalLink className="size-3.5 shrink-0 text-grey-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Paste a link…"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-grey-400"
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          title="Fetch preview"
          className="flex size-5 shrink-0 items-center justify-center rounded-md bg-ink text-paper transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          <ArrowRight className="size-3" />
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-[10.5px] leading-relaxed text-red-600">
          <AlertCircle className="mt-px size-3 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-grey-400">
          Any article, doc, repo, or page — preview, read, and cite it.
        </p>
      )}
    </div>
  );
}
