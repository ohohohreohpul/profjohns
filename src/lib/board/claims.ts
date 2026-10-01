/**
 * What the Draft writes from: the board's insights, grouped under their
 * themes (in the Themes wall's order), each carrying its citation, so drafted
 * sections cite real, quoted evidence.
 */
import { INSIGHT_LABELS, shortCitation } from "@/lib/insight";
import type { CardDataFor } from "./schema";

interface InsightLike {
  readonly id: string;
  readonly data: Pick<CardDataFor["insight"], "type" | "statement" | "quote" | "source" | "themeId">;
}
interface ThemeLike {
  readonly id: string;
  readonly data: Pick<CardDataFor["theme"], "name">;
}

function line(i: InsightLike): string {
  const label = INSIGHT_LABELS[i.data.type] ?? "Insight";
  const cite = i.data.source
    ? ` — ${shortCitation({ authors: i.data.source.authors ?? "", year: i.data.source.year ?? 0, title: i.data.source.title }, i.data.quote?.page)}`
    : "";
  return `- [${label}] ${i.data.statement}${cite}`;
}

export function buildClaims(insights: readonly InsightLike[], themes: readonly ThemeLike[]): string {
  if (insights.length === 0) return "";
  const known = new Set(themes.map((t) => t.id));
  const blocks: string[] = [];
  for (const theme of themes) {
    const members = insights.filter((i) => i.data.themeId === theme.id);
    if (members.length > 0) blocks.push([`Theme: ${theme.data.name || "Untitled theme"}`, ...members.map(line)].join("\n"));
  }
  const loose = insights.filter((i) => !i.data.themeId || !known.has(i.data.themeId));
  if (loose.length > 0) blocks.push(["Other insights", ...loose.map(line)].join("\n"));
  return blocks.join("\n\n");
}
