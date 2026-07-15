import { Cursor as MousePointer2, Hand, type Icon } from "@phosphor-icons/react";

/**
 * Cursor tools for the canvas. `select` is the default pointer (click to
 * select, drag for a selection box); `pan` is the hand tool (drag to move the
 * viewport). Shared between the toolbar and the canvas so behavior and labels
 * stay in sync.
 */
export type CanvasTool = "select" | "pan";

export interface CanvasToolDef {
  id: CanvasTool;
  label: string;
  hint: string;
  icon: Icon;
  shortcut: string;
}

export const CANVAS_TOOLS: CanvasToolDef[] = [
  {
    id: "select",
    label: "Select",
    hint: "Click to select · drag for a selection box",
    icon: MousePointer2,
    shortcut: "V",
  },
  {
    id: "pan",
    label: "Hand",
    hint: "Drag to pan the canvas",
    icon: Hand,
    shortcut: "H",
  },
];
