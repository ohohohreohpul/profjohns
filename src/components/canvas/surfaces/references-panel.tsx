"use client";

import * as React from "react";
import { CaretDown as ChevronDown, BookBookmark as BookMarked, SealCheck, SealQuestion, SealWarning } from "@phosphor-icons/react";
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
import { extractCitedPaperIds } from "@/lib/document";
import type { PaperSource } from "@/lib/mock";

export function StyleSelector({ nodeId }: { nodeId: string }) {
  const style = useCanvasStore((s) => s.docs[nodeId]?.style ?? DEFAULT_STYLE);
  const setDocStyle = useCanvasStore((s) => s.setDocStyle);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md border border-grey-200 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-grey-100">
          <BookMarked className="size-3.5" />
          {STYLE_LABEL[style]}
          <ChevronDown className="size-3 text-grey-500" />
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

type VerifyStatus = "verified" | "unverified" | "pending" | "not_found";

interface VerifyResult {
  status: VerifyStatus;
  confidence: number;
  message: string;
  matchedDoi: string | null;
}

export function ReferencesPanel({ nodeId }: { nodeId: string }) {
  const style: CitationStyle = useCanvasStore(
    (s) => s.docs[nodeId]?.style ?? DEFAULT_STYLE,
  );
  const content = useCanvasStore((s) => s.docs[nodeId]?.content);
  const allSources = useNodeInputSources(nodeId);

  const cited = extractCitedPaperIds(content)
    .map((id) => allSources.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const [verifying, setVerifying] = React.useState(false);
  const [verdicts, setVerdicts] = React.useState<Record<string, VerifyResult>>({});

  async function verifyAll() {
    if (verifying || cited.length === 0) return;
    setVerifying(true);
    const results: Record<string, VerifyResult> = {};

    for (const paper of cited) {
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            doi: paper.doi,
          }),
        });
        const data = (await res.json()) as { verified: boolean; source: string; confidence: number; message: string; matchedDoi: string | null };
        results[paper.id] = {
          status: data.verified ? "verified" : "not_found",
          confidence: data.confidence,
          message: data.message,
          matchedDoi: data.matchedDoi,
        };
      } catch {
        results[paper.id] = {
          status: "not_found",
          confidence: 0,
          message: "Verification failed",
          matchedDoi: null,
        };
      }
    }

    setVerdicts(results);
    setVerifying(false);
  }

  return (
    <section className="mx-auto mt-4 max-w-2xl rounded-lg border border-grey-200 bg-paper px-10 py-6 shadow-flat">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-ink">References</h2>
          {Object.keys(verdicts).length > 0 && (
            <span className="flex items-center gap-1.5">
              {Object.values(verdicts).filter((v) => v.status === "verified").length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
                  <SealCheck className="size-3" />
                  {Object.values(verdicts).filter((v) => v.status === "verified").length} verified
                </span>
              )}
              {Object.values(verdicts).filter((v) => v.status === "not_found").length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                  <SealWarning className="size-3" />
                  {Object.values(verdicts).filter((v) => v.status === "not_found").length} unverified
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={verifyAll}
            disabled={verifying || cited.length === 0}
            className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[10.5px] font-medium text-grey-700 transition-colors hover:bg-grey-100 disabled:opacity-40"
          >
            {verifying ? "Verifying..." : "Verify all"}
          </button>
          <span className="text-[11px] uppercase tracking-wider text-grey-500">
            {STYLE_LABEL[style]} · {cited.length}
          </span>
        </div>
      </div>
      {cited.length === 0 ? (
        <p className="mt-3 text-sm text-grey-500">
          No citations yet. Use &ldquo;Cite in draft&rdquo; on a connected source to add one.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {cited.map((paper, i) => {
            const verdict = verdicts[paper.id];
            return (
              <li
                key={paper.id}
                className="flex items-start gap-2 text-sm leading-relaxed text-grey-700"
              >
                <span className="shrink-0">
                  {verdict?.status === "verified" ? (
                    <SealCheck className="size-4 text-emerald-500" weight="fill" />
                  ) : verdict?.status === "not_found" ? (
                    <SealQuestion className="size-4 text-amber-500" weight="fill" />
                  ) : (
                    <span className="grid size-4 place-items-center text-[10px] text-grey-400">{i + 1}</span>
                  )}
                </span>
                <span>
                  {formatReference(paper, style, i + 1)}
                  {verdict?.matchedDoi && (
                    <a
                      href={`https://doi.org/${verdict.matchedDoi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-[10px] text-blue-600 hover:underline"
                    >
                      DOI
                    </a>
                  )}
                  {verdict && verdict.status === "not_found" && (
                    <span className="ml-1 text-[10px] text-amber-600">
                      (not found in CrossRef)
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
