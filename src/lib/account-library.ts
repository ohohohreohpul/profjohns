import type { PaperSource } from "./mock";
import type { Project, Canvas } from "@/store/workspace-store";

const CANVAS_KEY = "lattice-canvas-v1";

export type LibraryKind = "document" | "source" | "link" | "media";

export interface ProjectRef {
  id: string;
  name: string;
}

/**
 * One item in the account-wide library — a document, source, link, or media
 * asset, tagged with every project it appears in. Sources/links are deduped
 * across the account; documents/media are unique per canvas node.
 */
export interface AccountLibraryItem {
  key: string;
  kind: LibraryKind;
  title: string;
  subtitle?: string;
  snippet?: string;
  thumb?: string;
  url?: string;
  href?: string;
  projects: ProjectRef[];
  topics: string[];
  source?: PaperSource;
}

interface PersistedNode {
  id: string;
  data?: {
    kind?: string;
    media?: { src?: string; name?: string; caption?: string; alt?: string };
    source?: PaperSource;
    image?: string;
    paper?: PaperSource;
  };
}

interface PersistedCanvasState {
  docs?: Record<string, { title?: string; blocks?: { text?: string }[] }>;
  sources?: Record<string, PaperSource[]>;
  nodes?: PersistedNode[];
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

/** Topics for filtering — a source's subject + its first concept labels. */
function topicsOf(s: PaperSource): string[] {
  const out: string[] = [];
  if (s.category) out.push(s.category);
  for (const c of s.concepts ?? []) {
    if (c?.name && !out.includes(c.name)) out.push(c.name);
    if (out.length >= 3) break;
  }
  return out;
}

function sourceSubtitle(s: PaperSource): string {
  return [s.authors, s.year, s.venue].filter(Boolean).join(" · ");
}

/**
 * Aggregate everything across the account: walk every project's canvases,
 * collect documents, sources, links, and media, and attach the project each
 * came from. Deduplicates sources/links by id and merges their project refs.
 */
export function readAccountLibrary(
  projects: Project[],
  canvases: Canvas[],
  pinnedSources: Record<string, PaperSource[]>,
): AccountLibraryItem[] {
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const projectIds = new Set(projects.map((p) => p.id));
  const items: AccountLibraryItem[] = [];
  // Deduped sources/links keyed by source id → merge project refs.
  const byId = new Map<string, AccountLibraryItem>();

  function addRef(item: AccountLibraryItem, ref: ProjectRef) {
    if (ref.id && !item.projects.some((p) => p.id === ref.id)) {
      item.projects.push(ref);
    }
  }

  function upsertSource(s: PaperSource, ref: ProjectRef, image?: string) {
    if (!s?.id) return;
    const isLink = !!s.accessed;
    const key = `${isLink ? "link" : "src"}:${s.id}`;
    const existing = byId.get(key);
    if (existing) {
      addRef(existing, ref);
      if (image && !existing.thumb) existing.thumb = image;
      return;
    }
    const item: AccountLibraryItem = {
      key,
      kind: isLink ? "link" : "source",
      title: s.title || "Untitled",
      subtitle: sourceSubtitle(s),
      snippet: s.abstract?.slice(0, 200),
      thumb: image,
      url: s.url,
      projects: [],
      topics: topicsOf(s),
      source: s,
    };
    addRef(item, ref);
    byId.set(key, item);
    items.push(item);
  }

  for (const cv of canvases) {
    // Skip canvases whose project was deleted (orphaned store data).
    if (!projectIds.has(cv.projectId)) continue;
    const ref: ProjectRef = {
      id: cv.projectId,
      name: projectName.get(cv.projectId) ?? "Untitled project",
    };
    const st = readCanvasState(cv.id);
    if (!st) continue;

    // Documents — one per draft node.
    for (const [nodeId, doc] of Object.entries(st.docs ?? {})) {
      const text = (doc.blocks ?? []).map((b) => b.text ?? "").join(" ").trim();
      const words = text.split(/\s+/).filter(Boolean).length;
      items.push({
        key: `doc:${cv.id}:${nodeId}`,
        kind: "document",
        title: doc.title?.trim() || "Untitled",
        subtitle: `${words} word${words === 1 ? "" : "s"} · ${cv.name}`,
        snippet: text.slice(0, 200),
        href: `/doc?project=${cv.projectId}&canvas=${cv.id}&node=${nodeId}`,
        projects: [ref],
        topics: [],
      });
    }

    // Media + link nodes — read from the board for thumbnails the source map
    // doesn't carry.
    for (const node of st.nodes ?? []) {
      const kind = node.data?.kind;
      if (kind === "media" && node.data?.media?.src) {
        const m = node.data.media;
        items.push({
          key: `media:${cv.id}:${node.id}`,
          kind: "media",
          title: m.caption?.trim() || m.name?.trim() || "Image",
          subtitle: cv.name,
          thumb: m.src,
          projects: [ref],
          topics: [],
        });
      } else if (kind === "link" && node.data?.source) {
        upsertSource(node.data.source, ref, node.data.image);
      } else if (kind === "paper" && node.data?.paper) {
        upsertSource(node.data.paper, ref);
      }
    }

    // Sources flowing through the board (explorer keep-sets, library, etc.).
    for (const list of Object.values(st.sources ?? {})) {
      for (const s of list) upsertSource(s, ref);
    }
  }

  // Sources pinned to a project from Discover / uploaded in the Library tab.
  // Skip pinned sources whose project was deleted (orphaned data).
  for (const [projectId, list] of Object.entries(pinnedSources)) {
    if (!projectIds.has(projectId)) continue;
    const ref: ProjectRef = {
      id: projectId,
      name: projectName.get(projectId) ?? "Untitled project",
    };
    for (const s of list) upsertSource(s, ref);
  }

  return items;
}

/** Distinct topic labels across the items, most common first. */
export function collectTopics(items: AccountLibraryItem[]): string[] {
  const count = new Map<string, number>();
  for (const it of items) {
    for (const t of it.topics) count.set(t, (count.get(t) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

/**
 * Compact, line-per-item catalog the AI reasons over for chat + categorize.
 * Each line is `[key] kind | title | projects | subtitle` so the model can
 * reference items back by key.
 */
export function buildCatalog(items: AccountLibraryItem[]): string {
  return items
    .map((it) => {
      const projects = it.projects.map((p) => p.name).join(", ") || "—";
      const sub = it.subtitle ? ` | ${it.subtitle}` : "";
      return `[${it.key}] ${it.kind} | ${it.title} | projects: ${projects}${sub}`;
    })
    .join("\n")
    .slice(0, 50_000);
}
