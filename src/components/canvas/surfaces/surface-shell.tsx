"use client";

import * as React from "react";
import { X, ArrowsOutSimple as Maximize2, ArrowsInSimple as Minimize2 } from "@phosphor-icons/react";
import { NODE_DEFINITIONS, type NodeKind } from "@/lib/node-catalog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function SurfaceShell({
  kind,
  direction,
  onClose,
  toolbar,
  children,
}: {
  kind: NodeKind;
  direction: string;
  onClose: () => void;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const def = NODE_DEFINITIONS[kind];
  const Icon = def.icon;
  const [closing, setClosing] = React.useState(false);
  const [wide, setWide] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  function handleClose() {
    setClosing(true);
  }

  function handleAnimEnd(e: React.AnimationEvent) {
    if (closing && e.target === panelRef.current) onClose();
  }

  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      {/* Backdrop — canvas peeks through; click to close. */}
      <div
        onClick={handleClose}
        className={cn(
          "fixed inset-0 z-40 bg-ink/10",
          closing ? "opacity-0 transition-opacity duration-200" : "animate-backdrop-in",
        )}
      />
      <div
        ref={panelRef}
        onAnimationEnd={handleAnimEnd}
        style={{ borderTopColor: def.accent }}
        className={cn(
          "fixed bottom-0 right-0 top-0 z-40 flex flex-col border-l border-t-2 bg-paper",
          wide ? "left-0" : "w-[min(960px,96vw)]",
          "shadow-[-12px_0_40px_-16px_rgba(0,0,0,0.22)]",
          closing ? "animate-panel-out" : "animate-panel-in",
        )}
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-grey-200 px-4">
          <span
            className="grid size-6 place-items-center rounded-md border"
            style={{
              color: def.accent,
              backgroundColor: `color-mix(in oklch, ${def.accent} 10%, white)`,
              borderColor: `color-mix(in oklch, ${def.accent} 22%, transparent)`,
            }}
          >
            <Icon className="size-3.5" />
          </span>
          <span className="text-sm font-medium text-ink">{def.label}</span>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <span className="min-w-0 flex-1 truncate text-sm text-grey-500">
            {direction || "Untitled research direction"}
          </span>
          {toolbar}
          <button
            onClick={() => setWide((w) => !w)}
            aria-label={wide ? "Dock to side" : "Expand full width"}
            className="grid size-8 place-items-center rounded-md text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
          >
            {wide ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </button>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </>
  );
}
