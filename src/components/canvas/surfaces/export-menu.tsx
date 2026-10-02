"use client";

import * as React from "react";
import {
  Download,
  CaretDown as ChevronDown,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { exportDocument, EXPORT_LABEL, type ExportFormat } from "@/lib/export";
import { formatReference, DEFAULT_STYLE } from "@/lib/citation";
import { extractCitedPaperIds, type WritingDoc } from "@/lib/document";
import { useNodeInputSources } from "@/store/use-sources";
import { getDocEditor } from "@/components/editor/doc-editor";
import { listFigures } from "@/lib/draft-figures";
import { prepareFigureImages } from "./export-figures";

const NOTICE_MS = 6000;

const FORMATS: ExportFormat[] = ["markdown", "latex", "text", "docx"];

export function ExportMenu({
  nodeId,
  doc,
}: {
  nodeId: string;
  doc: WritingDoc | undefined;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);
  const allSources = useNodeInputSources(nodeId);

  async function handleExport(format: ExportFormat) {
    if (!doc) return;
    // The stored copy trails typing by a debounce: export what's on screen.
    const live = getDocEditor(nodeId);
    const current: WritingDoc = live
      ? { ...doc, content: live.getJSON() }
      : doc;
    setBusy(true);
    setError(null);
    try {
      const style = current.style ?? DEFAULT_STYLE;
      const references = extractCitedPaperIds(current.content)
        .map((id) => allSources.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p, i) => formatReference(p, style, i + 1));
      // Word gets the pictures; other formats carry the numbered captions.
      const hasFigures = listFigures(current.content).length > 0;
      const { images, failed } =
        format === "docx" && hasFigures
          ? await prepareFigureImages(current.content)
          : { images: new Map(), failed: 0 };
      await exportDocument(current, format, references, images);
      if (failed > 0) {
        setNotice(
          `Exported. ${failed} figure${failed === 1 ? "" : "s"} couldn't be embedded, so ${failed === 1 ? "its caption is" : "their captions are"} included without the picture.`,
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Export failed: ${err.message}`
          : "Export failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={!doc || busy}
            className="flex items-center gap-1.5 rounded-md border border-grey-200 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-grey-100 disabled:opacity-40"
          >
            <Download className="size-3.5" />
            Export
            <ChevronDown className="size-3 text-grey-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Export draft as</DropdownMenuLabel>
          {error && (
            <p className="mx-2 mb-1 flex items-center gap-1.5 rounded-md border border-feedback-danger-border bg-feedback-danger-bg/60 px-2 py-1.5 text-[10px] text-feedback-danger">
              <AlertCircle className="size-3 shrink-0" />
              {error}
            </p>
          )}
          {FORMATS.map((format) => (
            <DropdownMenuItem
              key={format}
              onSelect={() => handleExport(format)}
            >
              {EXPORT_LABEL[format]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {notice && (
        <span
          role="status"
          className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-feedback-warning-border bg-feedback-warning-bg px-2.5 py-2 text-xs text-ink shadow-lift"
        >
          {notice}
        </span>
      )}
    </span>
  );
}
