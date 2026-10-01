/**
 * "Tidy up" layout for the research canvas: a layered left-to-right layout
 * that follows the flow of work (Sources -> Synthesize -> Draft).
 *
 * - Column: each node sits one column right of the deepest node feeding it
 *   (longest path), so every connection points rightward.
 * - Order within a column: by the average position of the node's inputs
 *   (barycenter), which keeps connection lines from crossing; nodes with no
 *   inputs keep their current top-to-bottom order.
 * - Spacing: a column is as wide as its widest node; nodes stack with a gap,
 *   centred vertically, so nothing overlaps.
 */

export interface LayoutNode {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface LayoutEdge {
  readonly source: string;
  readonly target: string;
}

export type LayoutPositions = Record<string, { x: number; y: number }>;

const COLUMN_GAP = 120;
const ROW_GAP = 56;

/** Longest-path column per node; bounded so a cycle can't loop forever. */
function assignColumns(ids: readonly string[], edges: readonly LayoutEdge[]): Map<string, number> {
  const column = new Map(ids.map((id) => [id, 0]));
  const maxColumn = ids.length - 1;
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const { source, target } of edges) {
      const next = (column.get(source) ?? 0) + 1;
      if (next <= maxColumn && next > (column.get(target) ?? 0)) {
        column.set(target, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return column;
}

export function layoutLeftToRight(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  /** Current vertical order hint (e.g. each node's y); lower = higher up. */
  orderHint: Readonly<Record<string, number>> = {},
): LayoutPositions {
  const ids = nodes.map((n) => n.id);
  const known = new Set(ids);
  const links = edges.filter(
    (e) => known.has(e.source) && known.has(e.target) && e.source !== e.target,
  );
  const column = assignColumns(ids, links);
  const hint = (id: string) => orderHint[id] ?? ids.indexOf(id);

  const columnCount = Math.max(0, ...column.values()) + 1;
  const columns: string[][] = Array.from({ length: columnCount }, () => []);
  for (const id of ids) columns[column.get(id) ?? 0].push(id);

  // Order each column by its inputs' positions in the columns already placed.
  const rowOf = new Map<string, number>();
  columns.forEach((col, c) => {
    const key = (id: string): number => {
      const inputs = links
        .filter((e) => e.target === id && (column.get(e.source) ?? 0) < c && rowOf.has(e.source))
        .map((e) => rowOf.get(e.source) as number);
      return inputs.length > 0 ? inputs.reduce((a, b) => a + b, 0) / inputs.length : Number.NaN;
    };
    col.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (!Number.isNaN(ka) && !Number.isNaN(kb) && ka !== kb) return ka - kb;
      if (Number.isNaN(ka) !== Number.isNaN(kb)) return Number.isNaN(ka) ? 1 : -1;
      return hint(a) - hint(b);
    });
    col.forEach((id, row) => rowOf.set(id, row));
  });

  const size = new Map(nodes.map((n) => [n.id, n]));
  const positions: LayoutPositions = {};
  let x = 0;
  for (const col of columns) {
    const heights = col.map((id) => size.get(id)?.height ?? 0);
    const total = heights.reduce((a, b) => a + b, 0) + ROW_GAP * Math.max(0, col.length - 1);
    let y = -total / 2;
    col.forEach((id, i) => {
      positions[id] = { x, y };
      y += heights[i] + ROW_GAP;
    });
    const widest = Math.max(0, ...col.map((id) => size.get(id)?.width ?? 0));
    x += widest + COLUMN_GAP;
  }
  return positions;
}
