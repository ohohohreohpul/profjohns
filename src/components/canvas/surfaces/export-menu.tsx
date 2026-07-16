"use client";

import * as React from "react";
import { Download, CaretDown as ChevronDown } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  exportDocument,
  EXPORT_LABEL,
  type ExportFormat,
} from "@/lib/export";
import { formatReference, DEFAULT_STYLE } from "@/lib/citation";
import { extractCitedPaperIds, type WritingDoc } from "@/lib/document";
import { useNodeInputSources } from "@/store/use-sources";

const FORMATS: ExportFormat[] = ["pdf", "latex", "bibtex", "docx", "markdown", "text"];

export function ExportMenu({
  nodeId,
  doc,
}: {
  nodeId: string;
  doc: WritingDoc | undefined;
}) {
  const [busy, setBusy] = React.useState(false);
  const allSources = useNodeInputSources(nodeId);

  async function handleExport(format: ExportFormat) {
    if (!doc) return;
    setBusy(true);
    try {
      const style = doc.style ?? DEFAULT_STYLE;
      const references = extractCitedPaperIds(doc.content)
        .map((id) => allSources.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p, i) => formatReference(p, style, i + 1));
      await exportDocument(doc, format, references, allSources);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={!doc || busy}
          className="flex items-center gap-1.5 rounded-md border border-grey-200 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-grey-100 disabled:opacity-40"
        >
          <Download className="size-3.5" />
          Export
          <ChevronDown className="size-3 text-grey-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Export draft as</DropdownMenuLabel>
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
  );
}
