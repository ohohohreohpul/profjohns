"use client";

import * as React from "react";
import { NODE_DEFINITIONS, type NodeKind } from "@/lib/node-catalog";

/**
 * Floating menu listing node kinds at a screen position. Shared by the
 * drag-from-edge spawn flow and the right-click "add node" menu. Closes on
 * outside click or Escape, and flips up/left to stay within the viewport.
 */
export function NodeMenu({
  title,
  screen,
  options,
  onPick,
  onClose,
}: {
  title: string;
  screen: { x: number; y: number };
  options: NodeKind[];
  onPick: (kind: NodeKind) => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // pointerdown matches React Flow's pointer-based interactions, so clicking
    // anywhere on the canvas reliably dismisses the menu.
    function handleDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handleDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", handleDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // Keep the menu fully on-screen. Cap its height to the space available below
  // its top edge (never measuring DOM), so it can't exceed the viewport and the
  // list scrolls when there are more options than fit.
  const MENU_WIDTH = 240;
  const MARGIN = 12;
  const MIN_HEIGHT = 160;
  const left = Math.max(
    MARGIN,
    Math.min(screen.x, window.innerWidth - MENU_WIDTH - MARGIN),
  );
  const top = Math.max(
    MARGIN,
    Math.min(screen.y, window.innerHeight - MARGIN - MIN_HEIGHT),
  );
  const maxHeight = window.innerHeight - top - MARGIN;

  return (
    <div
      ref={ref}
      style={{ left, top, maxHeight }}
      className="fixed z-50 flex w-60 flex-col rounded-lg border border-grey-200 bg-paper p-1.5 shadow-lift"
    >
      <p className="shrink-0 px-2 py-1 text-[11px] uppercase tracking-wider text-grey-400">
        {title}
      </p>
      <div className="min-h-0 space-y-0.5 overflow-y-auto">
        {options.map((kind) => {
          const def = NODE_DEFINITIONS[kind];
          const Icon = def.icon;
          return (
            <button
              key={kind}
              onClick={() => onPick(kind)}
              className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-grey-100"
            >
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-grey-100 text-ink">
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {def.label}
                </span>
                <span className="block text-[11px] leading-snug text-grey-400">
                  {def.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
