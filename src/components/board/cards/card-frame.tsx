"use client";

import * as React from "react";
import { DotsThree, ArrowRight, Trash } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Wall } from "@/lib/board/schema";

/** dataTransfer type carrying a card id while it is dragged between walls. */
export const CARD_DND_MIME = "application/x-profjohns-card";

interface CardFrameProps {
  readonly cardId: string;
  /** Short type label, e.g. "Paper", "Finding". */
  readonly label: string;
  readonly accent: string;
  readonly walls: readonly Wall[];
  readonly currentWallId: string | null;
  readonly onMove: (wallId: string) => void;
  readonly onDelete: () => void;
  readonly deleteLabel?: string;
  readonly dimmed?: boolean;
  readonly children: React.ReactNode;
}

/** Shared chrome for every card: type chip, menu (Move to / Delete), drag. */
export function CardFrame({
  cardId,
  label,
  accent,
  walls,
  currentWallId,
  onMove,
  onDelete,
  deleteLabel = "Delete",
  dimmed,
  children,
}: CardFrameProps) {
  const [dragging, setDragging] = React.useState(false);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(CARD_DND_MIME, cardId);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      data-card-id={cardId}
      className={cn(
        "group relative rounded-lg border border-grey-200 bg-paper p-3 transition-shadow hover:shadow-sm",
        dimmed && "bg-grey-50",
        dragging && "opacity-40",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-grey-600">
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: accent }} />
          {label}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${label} card options`}
              className="ml-auto grid size-6 place-items-center rounded-md text-grey-500 opacity-0 transition-opacity hover:bg-grey-100 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {walls
              .filter((w) => w.id !== currentWallId)
              .map((w) => (
                <DropdownMenuItem key={w.id} onSelect={() => onMove(w.id)}>
                  <ArrowRight className="size-4 text-grey-500" />
                  Move to {w.title}
                </DropdownMenuItem>
              ))}
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-feedback-danger data-[highlighted]:bg-feedback-danger-bg"
            >
              <Trash className="size-4" />
              {deleteLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children}
    </article>
  );
}
