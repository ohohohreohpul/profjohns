import { test, expect } from "@playwright/test";
import {
  parseCardData,
  DEFAULT_WALLS,
  WALL_KINDS,
} from "../src/lib/board/schema";
import { positionBetween, positionsFor } from "../src/lib/board/position";

/** Unit tests for the v2 board model (docs/REBUILD.md §2-3, §7). */

test.describe("card payloads", () => {
  test("accepts a valid insight with a verbatim quote and paragraph", () => {
    const data = parseCardData("insight", {
      type: "finding",
      statement: "Display-ad effects are tiny and need very large samples.",
      quote: { text: "Display-ad effects are tiny", paraIndex: 3 },
      source: { paperId: "W1", title: "Inferno", year: 2023 },
      origin: "study",
    });
    expect(data.type).toBe("finding");
  });

  test("rejects an insight with no statement", () => {
    expect(() =>
      parseCardData("insight", { type: "claim", statement: "", origin: "manual" }),
    ).toThrow();
  });

  test("rejects an unknown insight type", () => {
    expect(() =>
      parseCardData("insight", { type: "vibe", statement: "x", origin: "manual" }),
    ).toThrow();
  });

  test("paper cards default to New status", () => {
    const data = parseCardData("paper", {
      paper: { id: "W1", title: "T", authors: "A", venue: "V", year: 2024, abstract: "" },
    });
    expect(data.status).toBe("new");
  });

  test("strips unknown keys so the DB never stores junk", () => {
    const data = parseCardData("note", { text: "hi", evil: "<script>" }) as Record<string, unknown>;
    expect(data.evil).toBeUndefined();
  });
});

test.describe("default walls", () => {
  test("follow the research flow left to right", () => {
    expect(DEFAULT_WALLS.map((w) => w.kind)).toEqual([
      "question", "sources", "reading", "insights", "themes", "draft",
    ]);
    expect(DEFAULT_WALLS.every((w) => WALL_KINDS.includes(w.kind))).toBe(true);
  });
});

test.describe("positions", () => {
  test("a position between two neighbours sorts between them", () => {
    const p = positionBetween(1, 2);
    expect(p).toBeGreaterThan(1);
    expect(p).toBeLessThan(2);
  });

  test("handles inserting at either end", () => {
    expect(positionBetween(undefined, 5)).toBeLessThan(5);
    expect(positionBetween(5, undefined)).toBeGreaterThan(5);
    expect(positionBetween(undefined, undefined)).toBe(0);
  });

  test("positionsFor spaces n items evenly and increasingly", () => {
    const ps = positionsFor(4);
    expect(ps).toHaveLength(4);
    expect([...ps].sort((a, b) => a - b)).toEqual(ps);
    expect(new Set(ps).size).toBe(4);
  });
});
