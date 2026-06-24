"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, BookOpen, ArrowSquareOut as ExternalLink, Quotes as Quote, Check, Upload, CircleNotch as Loader2 } from "@phosphor-icons/react";
import { SpaceLayout } from "../space-layout";
import { useWorkspaceStore } from "@/store/workspace-store";
import { uploadPdf } from "@/lib/sources-client";
import {
  readProjectLibrary,
  formatCitation,
  type LibrarySource,
} from "@/lib/project-library";
import { motion } from "motion/react";
import { staggerContainer, fadeUp } from "@/lib/motion-variants";

export function LibrarySurface() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";

  const canvases = useWorkspaceStore((s) => s.canvases);
  const pinnedSources = useWorkspaceStore((s) => s.pinnedSources);
  const pinSource = useWorkspaceStore((s) => s.pinSource);
  const pruneOrphans = useWorkspaceStore((s) => s.pruneOrphans);

  React.useEffect(() => { pruneOrphans(); }, [pruneOrphans]);

  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload(file: File | undefined) {
    if (!file || !projectId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const source = await uploadPdf(file);
      pinSource(projectId, source);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // Aggregate across the project's canvases (read from persisted boards) plus
  // anything pinned from Discover. Snapshot — recomputed when canvases change.
  const { documents, sources } = React.useMemo(() => {
    const own = canvases.filter((c) => c.projectId === projectId);
    return readProjectLibrary(own, pinnedSources[projectId] ?? []);
  }, [canvases, projectId, pinnedSources]);

  return (
    <SpaceLayout active="library" projectId={projectId}>
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp}>
      <p className="mb-5 text-[13px] text-grey-500">
        {documents.length} document{documents.length === 1 ? "" : "s"} · {sources.length}{" "}
        source{sources.length === 1 ? "" : "s"} across this project
      </p>
      </motion.div>

      <motion.div variants={fadeUp}>
      <section>
        <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-grey-400">
          <FileText className="size-3" />
          Documents
        </h2>
        {documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-grey-200 px-4 py-8 text-center text-[12px] text-grey-400">
            Drafts from any canvas in this project appear here.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {documents.map((d) => (
              <Link
                key={`${d.canvasId}:${d.id}`}
                href={`/doc?project=${projectId}&canvas=${d.canvasId}&node=${d.id}`}
                className="group flex flex-col rounded-xl border border-grey-200 bg-paper p-4 shadow-[0_1px_2px_rgba(21,23,28,0.04)] transition-shadow hover:shadow-[0_12px_28px_-18px_rgba(21,23,28,0.3)]"
              >
                <p className="line-clamp-1 text-[13px] font-semibold tracking-tight text-ink">
                  {d.title}
                </p>
                <p className="mt-1 line-clamp-3 flex-1 text-[11.5px] leading-relaxed text-grey-500">
                  {d.snippet || "Empty draft"}
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-grey-400">
                  <span className="tabular-nums">
                    {d.words} word{d.words === 1 ? "" : "s"}
                  </span>
                  <span className="truncate pl-2 text-grey-300">{d.canvasName}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      </motion.div>

      <motion.div variants={fadeUp}>
      <section className="mt-8">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-grey-400">
            <BookOpen className="size-3" />
            Sources
          </h2>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-grey-200 bg-paper px-2.5 py-1 text-[11px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {uploading ? "Reading…" : "Upload PDF"}
          </button>
        </div>
        {uploadError && (
          <p className="mb-2 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-[11px] text-red-600">
            {uploadError}
          </p>
        )}
        {sources.length === 0 ? (
          <p className="rounded-xl border border-dashed border-grey-200 px-4 py-8 text-center text-[12px] text-grey-400">
            Sources you keep on a canvas — or pin from Discover — appear here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-grey-200">
            {sources.map((s, i) => (
              <SourceRow key={s.id} source={s} first={i === 0} canvasName={canvases.find((c) => c.id === s.origin)?.name} />
            ))}
          </div>
        )}
      </section>
      </motion.div>
      </motion.div>
    </SpaceLayout>
  );
}

function SourceRow({ source, first, canvasName }: { source: LibrarySource; first: boolean; canvasName?: string }) {
  const [copied, setCopied] = React.useState(false);

  function cite() {
    navigator.clipboard?.writeText(formatCitation(source)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  const originLabel = source.origin === "pinned" ? "Saved from Discover" : canvasName ? `From ${canvasName}` : null;

  return (
    <div
      className={`flex items-start gap-3 bg-paper px-4 py-3 ${first ? "" : "border-t border-grey-100"}`}
    >
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-grey-100 text-grey-500">
        <BookOpen className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[12.5px] font-medium text-ink">{source.title}</p>
        <p className="text-[10.5px] text-grey-400">
          {[source.authors, source.year, source.venue].filter(Boolean).join(" · ")}
        </p>
        {originLabel && (
          <p className="mt-0.5 text-[9.5px] italic text-grey-300">{originLabel}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={cite}
          className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[10.5px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink"
        >
          {copied ? <Check className="size-3 text-emerald-600" /> : <Quote className="size-3" />}
          {copied ? "Copied" : "Cite"}
        </button>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
          >
            <ExternalLink className="size-3" />
            Source
          </a>
        )}
      </div>
    </div>
  );
}
