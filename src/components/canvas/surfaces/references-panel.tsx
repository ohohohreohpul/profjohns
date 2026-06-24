"use client";

import { CaretDown as ChevronDown, BookBookmark as BookMarked } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  formatReference,
  STYLE_LABEL,
  STYLE_ORDER,
  DEFAULT_STYLE,
  type CitationStyle,
} from "@/lib/citation";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";

export function StyleSelector({ nodeId }: { nodeId: string }) {
  const style = useCanvasStore((s) => s.docs[nodeId]?.style ?? DEFAULT_STYLE);
  const setDocStyle = useCanvasStore((s) => s.setDocStyle);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md border border-grey-200 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-grey-100">
          <BookMarked className="size-3.5" />
          {STYLE_LABEL[style]}
          <ChevronDown className="size-3 text-grey-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Citation style</DropdownMenuLabel>
        {STYLE_ORDER.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => setDocStyle(nodeId, s)}>
            {STYLE_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReferencesPanel({ nodeId }: { nodeId: string }) {
  const style: CitationStyle = useCanvasStore(
    (s) => s.docs[nodeId]?.style ?? DEFAULT_STYLE,
  );
  const citationIds = useCanvasStore((s) => s.docs[nodeId]?.citationIds);
  const allSources = useNodeInputSources(nodeId);

  const cited = (citationIds ?? [])
    .map((id) => allSources.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <section className="mx-auto mt-4 max-w-2xl rounded-lg border border-grey-200 bg-paper px-10 py-6 shadow-flat">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-ink">References</h2>
        <span className="text-[11px] uppercase tracking-wider text-grey-400">
          {STYLE_LABEL[style]} · {cited.length}
        </span>
      </div>
      {cited.length === 0 ? (
        <p className="mt-3 text-sm text-grey-400">
          No citations yet. Use “Cite in draft” on a connected source to add one.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {cited.map((paper, i) => (
            <li
              key={paper.id}
              className="text-sm leading-relaxed text-grey-700"
            >
              {formatReference(paper, style, i + 1)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
