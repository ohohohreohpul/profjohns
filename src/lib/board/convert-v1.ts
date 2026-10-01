/**
 * One-time conversion of a v1 canvas board (React Flow nodes plus the
 * `sources` / `docs` side maps in the board blob) into v2 cards placed on
 * walls (docs/REBUILD.md §10). Pure: reads the old board, never changes it.
 * Every output payload is validated; anything that doesn't fit is dropped.
 */
import { parseCardData, type CardKind, type WallKind } from "./schema";
import { INSIGHT_LABELS } from "@/lib/insight";

export interface ConvertedCard {
  readonly wall: WallKind;
  readonly kind: CardKind;
  readonly data: unknown;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown): string => (typeof v === "string" ? v : "");

const LABEL_TO_TYPE = Object.fromEntries(Object.entries(INSIGHT_LABELS).map(([type, label]) => [label, type]));
/** The Text-node format written by lib/insight formatInsightNote. */
const INSIGHT_NOTE = new RegExp(`^(${Object.values(INSIGHT_LABELS).join("|")}): "([\\s\\S]+)"\\n— (.+)$`);
const PAGE_IN_CITE = /p\. (\d+)/;

function tryCard(wall: WallKind, kind: CardKind, data: unknown): ConvertedCard | null {
  try {
    return { wall, kind, data: parseCardData(kind, data) };
  } catch {
    return null;
  }
}

function insightFromNote(text: string): unknown | null {
  const m = text.match(INSIGHT_NOTE);
  if (!m) return null;
  const [, label, passage, cite] = m;
  const page = cite.match(PAGE_IN_CITE);
  return {
    type: LABEL_TO_TYPE[label] ?? "quote",
    statement: passage,
    quote: { text: passage, ...(page ? { page: Number(page[1]) } : {}) },
    origin: "migrated",
  };
}

export function convertV1Board(state: unknown): ConvertedCard[] {
  if (!isRec(state)) return [];
  const nodes = asArray(state.nodes).filter(isRec);
  const sources = isRec(state.sources) ? state.sources : {};
  const docs = isRec(state.docs) ? state.docs : {};
  const out: (ConvertedCard | null)[] = [];
  const seenPapers = new Set<string>();

  const addPaper = (wall: WallKind, paper: unknown) => {
    if (!isRec(paper) || typeof paper.id !== "string" || seenPapers.has(paper.id)) return;
    seenPapers.add(paper.id);
    out.push(tryCard(wall, "paper", { paper, status: "kept" }));
  };

  const direction = asString(state.direction).trim();
  if (direction) out.push(tryCard("question", "question", { text: direction }));

  // Pinned Paper nodes are what the user chose to read; place them first so
  // a paper that was both kept and pinned lands in Reading.
  for (const n of nodes) {
    const data = isRec(n.data) ? n.data : {};
    if (data.kind === "paper") addPaper("reading", data.paper);
    if (data.kind === "link") addPaper("reading", data.source);
  }

  for (const n of nodes) {
    const id = asString(n.id);
    const data = isRec(n.data) ? n.data : {};
    switch (data.kind) {
      case "explorer":
        for (const p of asArray(sources[id])) addPaper("sources", p);
        break;
      case "text":
      case "block": {
        const text = asString(data.text).trim();
        if (!text) break;
        const insight = insightFromNote(text);
        out.push(insight ? tryCard("insights", "insight", insight) : tryCard("insights", "note", { text }));
        break;
      }
      case "processor": {
        const synthesis = isRec(data.synthesis) ? data.synthesis : {};
        for (const c of asArray(synthesis.claims).filter(isRec)) {
          const claim = asString(c.claim).trim();
          if (claim) out.push(tryCard("insights", "insight", { type: "claim", statement: claim, origin: "migrated" }));
        }
        break;
      }
      case "writing": {
        const doc = isRec(docs[id]) ? docs[id] : null;
        if (!doc) break;
        out.push(
          tryCard("draft", "draft", {
            title: asString(doc.title),
            content: isRec(doc.content) ? doc.content : { type: "doc", content: [] },
            style: asString(doc.style) || "apa",
            outline: asArray(doc.outline).filter((x): x is string => typeof x === "string"),
          }),
        );
        break;
      }
      default:
        // explorer handled; paper/link placed above; shell, assistant,
        // library and media carry no knowledge to move.
        break;
    }
  }
  return out.filter((c): c is ConvertedCard => c !== null);
}
