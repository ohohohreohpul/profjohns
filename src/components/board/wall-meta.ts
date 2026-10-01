import {
  Question,
  MagnifyingGlass,
  BookOpenText,
  Lightbulb,
  Stack,
  PenNib,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import type { WallKind } from "@/lib/board/schema";

export interface WallMeta {
  readonly icon: Icon;
  /** CSS colour (token) for the wall's identity edge and icon. */
  readonly accent: string;
  /** Empty state: what the wall is for, then how to start. */
  readonly empty: { readonly what: string; readonly start: string };
}

/** Identity + empty-state copy per wall (docs/REBUILD.md §2). */
export const WALL_META: Record<WallKind, WallMeta> = {
  question: {
    icon: Question,
    accent: "var(--color-ink)",
    empty: { what: "The question this research answers.", start: "Every search and summary on this board reads it." },
  },
  sources: {
    icon: MagnifyingGlass,
    accent: "var(--color-node-explorer)",
    empty: { what: "Papers you find land here.", start: "Search for papers to start filling this column." },
  },
  reading: {
    icon: BookOpenText,
    accent: "var(--color-node-reader)",
    empty: { what: "Papers you are studying.", start: "Move a kept paper here to read it with help." },
  },
  insights: {
    icon: Lightbulb,
    accent: "var(--color-node-processor)",
    empty: { what: "What you take from each paper.", start: "Every insight keeps its quote and paragraph." },
  },
  themes: {
    icon: Stack,
    accent: "var(--color-node-assistant)",
    empty: { what: "The arguments your paper will make.", start: "Group related insights into a theme." },
  },
  draft: {
    icon: PenNib,
    accent: "var(--color-node-writing)",
    empty: { what: "Your paper.", start: "Its sections follow your themes." },
  },
  custom: {
    icon: SquaresFour,
    accent: "var(--color-grey-500)",
    empty: { what: "Your own column.", start: "Drop anything here." },
  },
};
