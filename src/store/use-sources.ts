import { useMemo } from "react";
import { useCanvasStore, type CanvasNode } from "./canvas-store";
import type { PaperSource } from "@/lib/mock";

export interface FilterCriteria {
  minYear?: number;
  minCitations?: number;
  venue?: string;
}

/** Apply a filter node's criteria to a set of papers. */
export function filterPapers(
  papers: PaperSource[],
  filter: FilterCriteria | undefined,
): PaperSource[] {
  if (!filter) return papers;
  return papers.filter((p) => {
    if (filter.minYear && p.year < filter.minYear) return false;
    if (filter.minCitations && (p.citations ?? 0) < filter.minCitations)
      return false;
    if (
      filter.venue &&
      !p.venue.toLowerCase().includes(filter.venue.toLowerCase())
    )
      return false;
    return true;
  });
}

function dedupe(papers: PaperSource[]): PaperSource[] {
  const seen = new Set<string>();
  const out: PaperSource[] = [];
  for (const p of papers) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/**
 * Compute each node's *output* papers by walking the graph:
 * - source / finder → their own fetched results (producers)
 * - paper → the single paper it pins (producer)
 * - filter → its inputs, narrowed by its criteria (transformer)
 * - everything else → passes its inputs through unchanged
 * A node's input = the union of its direct incomers' outputs.
 */
function buildResolver(
  nodes: CanvasNode[],
  edges: { source: string; target: string }[],
  sources: Record<string, PaperSource[]>,
) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incomers = new Map<string, string[]>();
  for (const e of edges) {
    const list = incomers.get(e.target) ?? [];
    list.push(e.source);
    incomers.set(e.target, list);
  }

  const memo = new Map<string, PaperSource[]>();
  const visiting = new Set<string>();

  function output(id: string): PaperSource[] {
    const cached = memo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return []; // cycle guard
    visiting.add(id);

    const node = byId.get(id);
    const kind = node?.data.kind;
    const inputs = dedupe((incomers.get(id) ?? []).flatMap(output));

    let result: PaperSource[];
    if (
      kind === "explorer" ||
      kind === "paper" ||
      kind === "library" ||
      kind === "link"
    ) {
      // Producers: the Sources scout exposes its kept set; a Paper node exposes
      // its single source; a Library node exposes the project's saved sources;
      // a Link node exposes its one web source. All publish into the sources
      // map via setNodeSources.
      result = sources[id] ?? [];
    } else {
      result = inputs;
    }

    visiting.delete(id);
    memo.set(id, result);
    return result;
  }

  return {
    inputsOf: (id: string) => dedupe((incomers.get(id) ?? []).flatMap(output)),
  };
}

/**
 * Papers flowing INTO a node through its incoming edges. Returns an empty
 * array when nothing is connected, so a node only ever shows what is wired
 * into it.
 */
export function useNodeInputSources(nodeId: string): PaperSource[] {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const sources = useCanvasStore((s) => s.sources);
  return useMemo(
    () => buildResolver(nodes, edges, sources).inputsOf(nodeId),
    [nodeId, nodes, edges, sources],
  );
}
