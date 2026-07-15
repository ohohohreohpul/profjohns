"use client";

import * as React from "react";
import { Check, CaretUpDown as ChevronsUpDown, Coins } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  MODELS,
  PROVIDER_LABEL,
  TIER_LABEL,
  getModel,
  type ModelProvider,
} from "@/lib/models";

const PROVIDER_ORDER: ModelProvider[] = ["anthropic", "google", "openai"];

export function ModelPicker({
  modelId,
  onChange,
}: {
  modelId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const current = getModel(modelId);

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="nodrag flex items-center gap-1.5 rounded-md border border-grey-200 bg-grey-50 px-2 py-1 text-xs font-medium text-grey-700 transition-colors hover:border-grey-300 hover:bg-grey-100"
          aria-label="Choose model"
        >
          <span className="max-w-[7.5rem] truncate">{current.label}</span>
          <span className="flex items-center gap-0.5 text-grey-400">
            <Coins className="size-3" />
            {current.creditsPerRun}
          </span>
          <ChevronsUpDown className="size-3 text-grey-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="nodrag w-80 p-1.5">
        <div className="px-2 pb-1.5 pt-1">
          <p className="text-xs font-medium text-ink">Route this action</p>
          <p className="text-[11px] text-grey-400">
            Credit cost is estimated per run.
          </p>
        </div>
        <Separator className="my-1" />
        <div className="max-h-72 space-y-2 overflow-y-auto p-1">
          {PROVIDER_ORDER.map((provider) => (
            <div key={provider}>
              <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-grey-400">
                {PROVIDER_LABEL[provider]}
              </p>
              {MODELS.filter((m) => m.provider === provider).map((model) => {
                const selected = model.id === modelId;
                return (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model.id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-grey-100",
                      selected && "bg-grey-100",
                    )}
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                      {selected && <Check className="size-3.5 text-ink" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">
                          {model.label}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-grey-500">
                          <Coins className="size-3" />
                          {model.creditsPerRun}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="rounded-sm bg-grey-100 px-1 text-[10px] uppercase tracking-wide text-grey-500">
                          {TIER_LABEL[model.tier]}
                        </span>
                        <span className="truncate text-[11px] text-grey-400">
                          {model.blurb}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
