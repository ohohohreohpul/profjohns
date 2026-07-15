"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  NODE_DEFINITIONS,
  CORE_ORDER,
  ADVANCED_ORDER,
  type NodeKind,
} from "@/lib/node-catalog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Plus, Cursor as MousePointer2, Hand } from "@phosphor-icons/react";

type Tool = "select" | "hand";

interface ToolbarProps {
  onAdd: (kind: NodeKind) => void;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
}

export function Toolbar({ onAdd, tool, onToolChange }: ToolbarProps) {
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <aside className="absolute left-4 top-1/2 z-20 -translate-y-1/2">
      <div className="flex flex-col items-center gap-1 rounded-xl border border-grey-200 bg-paper p-1.5 shadow-sm">
        {/* Pointer tools — Select (box-select) and Hand (drag to pan) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Select tool"
              aria-pressed={tool === "select"}
              onClick={() => onToolChange("select")}
              className={cn(
                "grid size-10 place-items-center rounded-lg transition-colors",
                tool === "select"
                  ? "bg-ink text-paper"
                  : "text-grey-500 hover:bg-grey-100 hover:text-ink",
              )}
            >
              <MousePointer2 className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-medium">
              Select <span className="text-grey-300">· V</span>
            </p>
            <p className="text-grey-300">Click to select, right-click for nodes</p>
            <p className="text-grey-400 mt-0.5">
              <span className="font-medium text-grey-500">Space</span> + drag = pan
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Hand tool"
              aria-pressed={tool === "hand"}
              onClick={() => onToolChange("hand")}
              className={cn(
                "grid size-10 place-items-center rounded-lg transition-colors",
                tool === "hand"
                  ? "bg-ink text-paper"
                  : "text-grey-500 hover:bg-grey-100 hover:text-ink",
              )}
            >
              <Hand className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-medium">
              Hand <span className="text-grey-300">· H</span>
            </p>
            <p className="text-grey-300">Drag anywhere to pan the canvas</p>
          </TooltipContent>
        </Tooltip>

        <Separator className="my-1 w-6" />

        {/* Core nodes */}
        {CORE_ORDER.map((kind) => {
          const def = NODE_DEFINITIONS[kind];
          const Icon = def.icon;
          return (
            <Tooltip key={kind}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onAdd(kind)}
                  style={{ "--a": def.accent } as React.CSSProperties}
                  className="palette-btn grid size-10 place-items-center rounded-xl transition-colors"
                  aria-label={`Add ${def.label} node`}
                >
                  <Icon className="size-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{def.label}</p>
                <p className="text-grey-300">{def.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        <Separator className="my-1 w-6" />

        {/* More */}
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  aria-label="More nodes"
                  className={cn(
                    "grid size-10 place-items-center rounded-lg transition-colors text-grey-500 hover:bg-grey-100 hover:text-ink",
                    moreOpen && "bg-grey-100 text-ink",
                  )}
                >
                  <Plus className="size-[18px]" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-medium">More nodes</p>
              <p className="text-grey-300">Data viz, paper &amp; more</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="end">
            <div className="flex flex-col gap-0.5">
              <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-grey-400">
                Advanced
              </p>
              {ADVANCED_ORDER.map((kind) => {
                const def = NODE_DEFINITIONS[kind];
                const Icon = def.icon;
                return (
                  <button
                    key={kind}
                    onClick={() => {
                      onAdd(kind);
                      setMoreOpen(false);
                    }}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-grey-700 transition-colors hover:bg-grey-100 hover:text-ink"
                  >
                    <Icon className="size-3.5 shrink-0 text-grey-500" />
                    <span>{def.label}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}