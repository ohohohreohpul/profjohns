"use client";

import * as React from "react";
import { Check, Plus } from "@phosphor-icons/react";
import {
  PROVIDER_ORDER,
  PROVIDER_LABEL,
  type SourceProvider,
} from "@/lib/sources-client";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface HeroSourceChip {
  provider: SourceProvider;
  label: string;
}

const DEFAULT_SOURCES: SourceProvider[] = ["openalex", "arxiv", "semanticscholar", "wikipedia"];

/** Parse a `sources=` URL param ("openalex,arxiv") into a typed list,
 *  dropping anything unrecognized. */
export function parseSourcesParam(raw: string | null): SourceProvider[] | undefined {
  if (!raw) return undefined;
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SourceProvider =>
      PROVIDER_ORDER.includes(s as SourceProvider),
    );
  return parsed.length > 0 ? parsed : undefined;
}

export function sourcesToParam(sources: SourceProvider[]): string {
  return sources.join(",");
}

interface Props {
  selected: SourceProvider[];
  onChange: (next: SourceProvider[]) => void;
}

/** Popover that lets the user pick which source providers the launched
 *  scout may search. Triggered by the `@` Sources button in the hero. */
export function HeroSourcesPopover({ selected, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  function toggle(p: SourceProvider) {
    if (selectedSet.has(p)) {
      // Don't allow removing the last source — the scout always needs one.
      if (selected.length <= 1) return;
      onChange(selected.filter((s) => s !== p));
    } else {
      onChange([...selected, p]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors",
            selected.length < DEFAULT_SOURCES.length
              ? "border-ink/30 bg-ink/5 text-ink"
              : "border-grey-200 text-grey-500 hover:bg-grey-50 hover:text-ink",
          )}
        >
          <Plus className="size-3.5" />
          Sources
          {selected.length < DEFAULT_SOURCES.length && (
            <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] tabular-nums">
              {selected.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-1.5">
        <p className="px-2 py-1.5 text-[11px] font-medium text-grey-500">
          Search these sources
        </p>
        <div className="flex flex-col gap-0.5">
          {PROVIDER_ORDER.map((p) => {
            const active = selectedSet.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggle(p)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
                  active
                    ? "bg-ink/5 text-ink"
                    : "text-grey-500 hover:bg-grey-50 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-grey-300",
                  )}
                >
                  {active && <Check className="size-3" />}
                </span>
                {PROVIDER_LABEL[p]}
              </button>
            );
          })}
        </div>
        <p className="mt-1 border-t border-grey-100 px-2 py-1.5 text-[10px] text-grey-500">
          The scout will only search the selected databases.
        </p>
      </PopoverContent>
    </Popover>
  );
}
