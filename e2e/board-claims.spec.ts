import { test, expect } from "@playwright/test";
import { buildClaims } from "../src/lib/board/claims";

/** The Draft writes from insights grouped by theme, each with its citation. */
const insight = (id: string, statement: string, themeId?: string, page?: number) => ({
  id,
  data: {
    type: "finding" as const,
    statement,
    quote: { text: statement, ...(page ? { page } : {}) },
    source: { paperId: "W1", title: "Inferno", authors: "Garrett A. Johnson", year: 2023 },
    origin: "study" as const,
    ...(themeId ? { themeId } : {}),
  },
});

test("groups insights under their themes, in theme order, with citations", () => {
  const text = buildClaims(
    [insight("i1", "Display ad effects are tiny", "t2", 3), insight("i2", "Bandits cut regret", "t1"), insight("i3", "Loose end")],
    [
      { id: "t1", data: { name: "Bandits beat A/B" } },
      { id: "t2", data: { name: "Effects are small" } },
    ],
  );
  expect(text).toBe(
    [
      "Theme: Bandits beat A/B",
      "- [Finding] Bandits cut regret — Garrett A. Johnson (2023)",
      "",
      "Theme: Effects are small",
      "- [Finding] Display ad effects are tiny — Garrett A. Johnson (2023), p. 3",
      "",
      "Other insights",
      "- [Finding] Loose end — Garrett A. Johnson (2023)",
    ].join("\n"),
  );
});

test("is empty when there are no insights", () => {
  expect(buildClaims([], [{ id: "t1", data: { name: "x" } }])).toBe("");
});
