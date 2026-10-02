/**
 * Retiring the board: turn a board's cards into canvas nodes (pure), laid out
 * in columns by research stage, with the board's relations as wires.
 * Unreviewed search results ("new" papers) that nothing cites stay behind.
 */
import type { JSONContent } from "@tiptap/core";
import type { BoardSnapshot, Card, CardDataFor } from "./schema";
import type { NodeKind } from "@/lib/node-catalog";
import type { PaperSource } from "@/lib/mock";
import type { Highlight } from "@/lib/highlight";
import type { WritingDoc } from "@/lib/document";
import type { CitationStyle } from "@/lib/citation";

export interface ImportedNode {
  /** The card id: links and draft references point at it until nodes exist. */
  readonly key: string;
  readonly kind: NodeKind;
  readonly position: { x: number; y: number };
  readonly data: Record<string, unknown>;
}

/** What the canvas already has (a board converted from it carries copies). */
export interface ExistingCanvas {
  readonly paperIds: ReadonlySet<string>;
  readonly texts: ReadonlySet<string>;
  /** JSON of each existing Draft document. */
  readonly docContents: ReadonlySet<string>;
  readonly direction?: string;
}

const NOTHING: ExistingCanvas = { paperIds: new Set(), texts: new Set(), docContents: new Set() };

export interface CanvasImport {
  readonly nodes: ImportedNode[];
  /** Cards not imported because the canvas already has them: links to them attach to the existing node. */
  readonly reused: Record<string, { paper: string } | { doc: string }>;
  readonly links: { from: string; to: string }[];
  /** Draft documents by card key. */
  readonly docs: Record<string, WritingDoc>;
  readonly highlights: Record<string, Highlight[]>;
  readonly direction?: string;
  readonly skippedPapers: number;
}

/** Columns, left to right, in research order. */
const COLUMNS = ["question", "papers", "evidence", "themes", "draft"] as const;
type Column = (typeof COLUMNS)[number];
const COLUMN_GAP_PX = 380;
/** Vertical room per node kind (rough rendered heights plus a gap). */
const ROW_PX: Partial<Record<NodeKind, number>> = { text: 160, paper: 280, insight: 220, figure: 320, chart: 380, theme: 200, writing: 460 };
const DEFAULT_ROW_PX = 240;

const COLUMN_OF: Record<Card["kind"], Column> = {
  question: "question",
  paper: "papers",
  insight: "evidence",
  note: "evidence",
  figure: "evidence",
  chart: "evidence",
  theme: "themes",
  draft: "draft",
};

const byPosition = (a: Card, b: Card) => a.position - b.position;

export function boardToCanvas(snapshot: BoardSnapshot, origin: { x: number; y: number }, existing: ExistingCanvas = NOTHING): CanvasImport {
  const reused: CanvasImport["reused"] = {};
  const wallOrder = new Map(snapshot.walls.map((w) => [w.id, w.position]));
  const cards = [...snapshot.cards].sort((a, b) => (wallOrder.get(a.wallId ?? "") ?? 0) - (wallOrder.get(b.wallId ?? "") ?? 0) || byPosition(a, b));
  const of = <K extends Card["kind"]>(kind: K) => cards.filter((c): c is Card<K> => c.kind === kind);

  const cited = new Set(of("insight").map((i) => i.data.source?.paperId).filter(Boolean));
  const papers = new Map<string, Card<"paper">>();
  let skippedPapers = 0;
  for (const p of of("paper")) {
    const keep = p.data.status === "kept" || cited.has(p.data.paper.id);
    if (!keep) skippedPapers++;
    else if (!papers.has(p.data.paper.id)) papers.set(p.data.paper.id, p);
  }
  const paperCardFor = (paperId?: string) => (paperId ? papers.get(paperId) : undefined);

  const rows = new Map<Column, number>(COLUMNS.map((c) => [c, origin.y]));
  const nodes: ImportedNode[] = [];
  const place = (card: Card, kind: NodeKind, data: Record<string, unknown>) => {
    const column = COLUMN_OF[card.kind];
    const y = rows.get(column) ?? origin.y;
    rows.set(column, y + (ROW_PX[kind] ?? DEFAULT_ROW_PX));
    nodes.push({ key: card.id, kind, position: { x: origin.x + COLUMNS.indexOf(column) * COLUMN_GAP_PX, y }, data });
  };

  const question = of("question")[0];
  for (const q of of("question")) {
    if (q.data.text && q.data.text !== existing.direction) place(q, "text", { text: `Research question: ${q.data.text}` });
  }
  for (const p of papers.values()) {
    if (existing.paperIds.has(p.data.paper.id)) reused[p.id] = { paper: p.data.paper.id };
    else place(p, "paper", { paper: p.data.paper, label: p.data.paper.title });
  }
  for (const c of cards) {
    if (c.kind === "insight") {
      const { themeId: _theme, ...insight } = c.data as CardDataFor["insight"];
      // "migrated" insights were made from this canvas's own notes and claims.
      if (insight.origin === "migrated") continue;
      place(c, "insight", { card: insight, paper: paperCardFor(insight.source?.paperId)?.data.paper });
    } else if (c.kind === "note") {
      const text = (c.data as CardDataFor["note"]).text;
      if (!existing.texts.has(text.trim())) place(c, "text", { text });
    } else if (c.kind === "figure" || c.kind === "chart") {
      const data = c.data as CardDataFor["figure"] | CardDataFor["chart"];
      place(c, c.kind, { card: data, paper: paperCardFor(data.source?.paperId)?.data.paper });
    }
  }
  for (const t of of("theme")) place(t, "theme", { card: t.data });
  const docs: Record<string, WritingDoc> = {};
  for (const d of of("draft")) {
    const json = JSON.stringify(d.data.content);
    if (existing.docContents.has(json)) {
      reused[d.id] = { doc: json };
      continue;
    }
    place(d, "writing", {});
    docs[d.id] = { title: d.data.title, content: d.data.content as JSONContent, style: d.data.style as CitationStyle, outline: d.data.outline };
  }

  const known = new Set([...nodes.map((x) => x.key), ...Object.keys(reused)]);
  const links: { from: string; to: string }[] = [];
  const themeIds = new Set(of("theme").map((t) => t.id));
  for (const i of of("insight")) {
    const from = paperCardFor(i.data.source?.paperId);
    if (from) links.push({ from: from.id, to: i.id });
    if (i.data.themeId && themeIds.has(i.data.themeId)) links.push({ from: i.id, to: i.data.themeId });
  }
  const draft = of("draft")[0];
  if (draft) {
    for (const t of of("theme")) links.push({ from: t.id, to: draft.id });
    for (const p of papers.values()) links.push({ from: p.id, to: draft.id });
  }

  const highlights: Record<string, Highlight[]> = {};
  for (const p of papers.values()) {
    if (p.data.highlights.length > 0) highlights[p.data.paper.id] = [...p.data.highlights];
  }

  return {
    nodes,
    reused,
    links: links.filter((l) => known.has(l.from) && known.has(l.to)),
    docs,
    highlights,
    direction: question?.data.text || undefined,
    skippedPapers,
  };
}

/** Papers an imported node publishes downstream (its citation). */
export function importedSources(node: ImportedNode): PaperSource[] {
  const paper = node.data.paper as PaperSource | undefined;
  return paper ? [paper] : [];
}
