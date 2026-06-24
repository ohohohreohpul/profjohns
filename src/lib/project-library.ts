import type { PaperSource } from "./mock";
import type { Canvas } from "@/store/workspace-store";

const CANVAS_KEY = "lattice-canvas-v1";

export interface LibraryDoc {
  id: string; // node id within its canvas
  canvasId: string;
  canvasName: string;
  title: string;
  words: number;
  snippet: string;
}

export interface LibrarySource extends PaperSource {
  /** Where it came from: a canvas id, or "pinned" when saved from Discover. */
  origin: string;
}

export interface ProjectLibrary {
  documents: LibraryDoc[];
  sources: LibrarySource[];
}

interface PersistedCanvasState {
  docs?: Record<string, { title?: string; blocks?: { text?: string }[] }>;
  sources?: Record<string, PaperSource[]>;
}

function readCanvasState(canvasId: string): PersistedCanvasState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${CANVAS_KEY}::${canvasId}`);
    return raw ? (JSON.parse(raw).state as PersistedCanvasState) : null;
  } catch {
    return null;
  }
}

/**
 * Aggregate documents + sources across ALL of a project's canvases (read from
 * each canvas's persisted board), plus any sources pinned to the project from
 * Discover. This makes the Library project-level instead of tied to one canvas.
 */
export function readProjectLibrary(
  projectCanvases: Canvas[],
  pinned: PaperSource[] = [],
): ProjectLibrary {
  const documents: LibraryDoc[] = [];
  const sourceMap = new Map<string, LibrarySource>();

  for (const cv of projectCanvases) {
    const st = readCanvasState(cv.id);
    if (!st) continue;

    for (const [nodeId, doc] of Object.entries(st.docs ?? {})) {
      const text = (doc.blocks ?? []).map((b) => b.text ?? "").join(" ");
      documents.push({
        id: nodeId,
        canvasId: cv.id,
        canvasName: cv.name,
        title: doc.title?.trim() || "Untitled",
        words: text.split(/\s+/).filter(Boolean).length,
        snippet: text.trim().slice(0, 160),
      });
    }

    for (const list of Object.values(st.sources ?? {})) {
      for (const s of list) {
        if (s?.id && !sourceMap.has(s.id)) sourceMap.set(s.id, { ...s, origin: cv.id });
      }
    }
  }

  for (const s of pinned) {
    if (s?.id && !sourceMap.has(s.id)) sourceMap.set(s.id, { ...s, origin: "pinned" });
  }

  return { documents, sources: [...sourceMap.values()] };
}

/** A simple, copyable citation for a source (APA-ish). */
export function formatCitation(s: PaperSource): string {
  const authors = s.authors || "Unknown author";
  const year = s.year ? ` (${s.year})` : "";
  // Web links cite with their URL + accessed date instead of a venue entry.
  if (s.accessed && s.url) {
    return `${authors}${year}. ${s.title}. ${s.url} (accessed ${s.accessed}).`
      .replace(/\s+/g, " ")
      .trim();
  }
  const venue = s.venue ? ` ${s.venue}.` : "";
  return `${authors}${year}. ${s.title}.${venue}`.replace(/\s+/g, " ").trim();
}
