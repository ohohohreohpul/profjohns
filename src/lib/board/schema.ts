/**
 * v2 board model — walls of typed cards (docs/REBUILD.md §2-3, §7).
 * Mirrors supabase/boards.sql. Card payloads are validated here before they
 * are written, so the `cards.data` JSONB only ever holds known shapes.
 */
import { z } from "zod";

export const WALL_KINDS = ["question", "sources", "reading", "insights", "themes", "draft", "custom"] as const;
export type WallKind = (typeof WALL_KINDS)[number];

export const CARD_KINDS = ["paper", "insight", "theme", "note", "question", "draft", "figure", "chart"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const INSIGHT_TYPES = ["claim", "finding", "method", "limitation", "gap", "definition", "quote"] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const LINK_RELATIONS = ["supports", "contradicts", "extends", "cites", "related"] as const;
export type LinkRelation = (typeof LINK_RELATIONS)[number];

/** The left-to-right research flow every new board starts with. */
export const DEFAULT_WALLS: readonly { kind: WallKind; title: string }[] = [
  { kind: "question", title: "Question" },
  { kind: "sources", title: "Sources" },
  { kind: "reading", title: "Reading" },
  { kind: "insights", title: "Insights" },
  { kind: "themes", title: "Themes" },
  { kind: "draft", title: "Draft" },
];

const PaperSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  authors: z.string(),
  venue: z.string(),
  year: z.number(),
  abstract: z.string(),
  citations: z.number().optional(),
  url: z.string().optional(),
  category: z.string().optional(),
  concepts: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  openAccess: z.boolean().optional(),
  pdfUrl: z.string().optional(),
  accessed: z.string().optional(),
});

/** Where an insight came from — enough to cite it without loading the paper. */
const SourceRefSchema = z.object({
  paperId: z.string().min(1),
  /** The Paper card on this board, when the paper is on the board. */
  cardId: z.string().optional(),
  title: z.string(),
  authors: z.string().optional(),
  year: z.number().optional(),
});

const PaperCardSchema = z.object({
  paper: PaperSourceSchema,
  status: z.enum(["new", "kept"]).default("new"),
  /** 0-100 relevance to the board's question (Jev). */
  score: z.number().min(0).max(100).optional(),
  why: z.string().optional(),
});

const InsightCardSchema = z.object({
  type: z.enum(INSIGHT_TYPES),
  statement: z.string().trim().min(1),
  /** Verbatim text from the paper — selected, never generated. */
  quote: z
    .object({
      text: z.string().min(1),
      /** 1-based PDF page, when the quote came from the PDF view. */
      page: z.number().int().min(1).optional(),
      /** Paragraph in the extracted-text view. */
      paraIndex: z.number().int().min(0).optional(),
    })
    .optional(),
  source: SourceRefSchema.optional(),
  /** Theme card this insight is clustered under, if any. */
  themeId: z.string().optional(),
  origin: z.enum(["study", "highlight", "manual", "migrated"]),
});

const ThemeCardSchema = z.object({
  /** May be empty while the user is still naming a new theme. */
  name: z.string(),
  summary: z.string().optional(),
});

const NoteCardSchema = z.object({ text: z.string() });

const QuestionCardSchema = z.object({ text: z.string() });

const DraftCardSchema = z.object({
  title: z.string(),
  /** ProseMirror JSON (validated by the editor, opaque here). */
  content: z.record(z.string(), z.unknown()),
  style: z.string(),
  outline: z.array(z.string()).default([]),
});

/** Where an image lives: the user's private storage (path), or an inline
 *  src for signed-out local development only. */
const ImageRefSchema = z
  .object({
    path: z.string().min(1).optional(),
    src: z.string().min(1).optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .refine((i) => !!i.path || !!i.src, "An image needs a stored path or a src.");

const FigureCardSchema = z.object({
  image: ImageRefSchema,
  caption: z.string().default(""),
  source: SourceRefSchema.optional(),
  /** 1-based PDF page the figure was captured from. */
  page: z.number().int().min(1).optional(),
  origin: z.enum(["upload", "paste", "pdf-capture", "migrated"]),
});

export const CHART_TYPES = ["bar", "line", "scatter", "table"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const MAX_CHART_ROWS = 200;
export const MAX_CHART_COLUMNS = 12;
const ChartCell = z.union([z.string(), z.number(), z.null()]);

const ChartCardSchema = z.object({
  title: z.string().default(""),
  type: z.enum(CHART_TYPES),
  columns: z.array(z.string()).min(1).max(MAX_CHART_COLUMNS),
  rows: z.array(z.array(ChartCell).max(MAX_CHART_COLUMNS)).max(MAX_CHART_ROWS),
  /** Column used for the x axis / categories. */
  xColumn: z.number().int().min(0),
  /** Columns plotted as series. */
  yColumns: z.array(z.number().int().min(0)).max(MAX_CHART_COLUMNS),
  caption: z.string().default(""),
  source: SourceRefSchema.optional(),
  page: z.number().int().min(1).optional(),
});

const CARD_DATA_SCHEMAS = {
  paper: PaperCardSchema,
  insight: InsightCardSchema,
  theme: ThemeCardSchema,
  note: NoteCardSchema,
  question: QuestionCardSchema,
  draft: DraftCardSchema,
  figure: FigureCardSchema,
  chart: ChartCardSchema,
} as const;

export type CardDataFor = {
  [K in CardKind]: z.infer<(typeof CARD_DATA_SCHEMAS)[K]>;
};

/** Validate and normalise a payload for `kind`; throws on invalid data. */
export function parseCardData<K extends CardKind>(kind: K, data: unknown): CardDataFor[K] {
  return CARD_DATA_SCHEMAS[kind].parse(data) as CardDataFor[K];
}

export interface Wall {
  readonly id: string;
  readonly boardId: string;
  readonly kind: WallKind;
  readonly title: string;
  readonly position: number;
  readonly collapsed: boolean;
}

export interface Card<K extends CardKind = CardKind> {
  readonly id: string;
  readonly boardId: string;
  readonly wallId: string | null;
  readonly kind: K;
  readonly position: number;
  readonly data: CardDataFor[K];
  readonly updatedAt: string;
}

export interface CardLink {
  readonly id: string;
  readonly boardId: string;
  readonly fromCard: string;
  readonly toCard: string;
  readonly relation: LinkRelation;
}

export interface BoardSnapshot {
  readonly walls: readonly Wall[];
  readonly cards: readonly Card[];
  readonly links: readonly CardLink[];
}
