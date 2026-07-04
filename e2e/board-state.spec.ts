import { test, expect } from "@playwright/test";
import { sanitizeBoardState } from "../src/lib/board-state";

/**
 * Unit tests (no browser) for the DB-blob validation behind the cross-device
 * board read. A malformed or empty row must yield null (→ fresh seed), and a
 * valid row must come back with ONLY the known board keys.
 */

const validBoard = () => ({
  direction: "cat cognition",
  nodes: [{ id: "n1" }, { id: "n2" }],
  edges: [{ id: "e1-2" }],
  creditsUsed: 3,
  nextId: 4,
  docs: {},
  sources: {},
  highlights: {},
  extracts: {},
  seeded: true,
  hintSeen: false,
});

test.describe("sanitizeBoardState", () => {
  test("accepts a valid board and returns all known keys", () => {
    const result = sanitizeBoardState(validBoard());

    expect(result).not.toBeNull();
    expect(result!.direction).toBe("cat cognition");
    expect((result!.nodes as unknown[]).length).toBe(2);
    expect(result!.seeded).toBe(true);
  });

  test("strips unknown keys so a DB row cannot inject state", () => {
    const blob = {
      ...validBoard(),
      boardCanvasId: "cv-evil", // transient key — must never pass through
      hasHydrated: true,
      __proto__injection: "nope",
    };

    const result = sanitizeBoardState(blob)!;

    expect("boardCanvasId" in result).toBe(false);
    expect("hasHydrated" in result).toBe(false);
    expect("__proto__injection" in result).toBe(false);
  });

  test.describe("rejects implausible blobs", () => {
    const cases: [string, unknown][] = [
      ["null", null],
      ["a string", "not a board"],
      ["an array", [1, 2, 3]],
      ["missing nodes", { edges: [] }],
      ["nodes not an array", { nodes: "x", edges: [] }],
      ["missing edges", { nodes: [{ id: "n1" }] }],
      ["empty nodes (empty blob)", { nodes: [], edges: [] }],
    ];

    for (const [label, blob] of cases) {
      test(label, () => {
        expect(sanitizeBoardState(blob)).toBeNull();
      });
    }
  });
});
