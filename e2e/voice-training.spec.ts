import { test, expect } from "@playwright/test";
import { pickExemplars, composeStyleProfile } from "../src/lib/voice-training";
import type { CorpusSample } from "../src/store/corpus-store";

/** Pure unit tests for the voice-training helpers (no store, no browser). */

const sample = (id: string, text: string): CorpusSample => ({
  id,
  name: id,
  text,
  addedAt: 0,
});

test.describe("pickExemplars", () => {
  test("takes the longest paragraph from each of the first `max` samples", () => {
    const samples = [
      sample("a", "short.\n\nthis is a much longer paragraph with more words in it"),
      sample("b", "b-only paragraph here"),
      sample("c", "c sample"),
      sample("d", "d sample — should be excluded by max"),
    ];
    const out = pickExemplars(samples, 3, 500);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("this is a much longer paragraph with more words in it");
    expect(out[1]).toBe("b-only paragraph here");
    expect(out.some((e) => e.includes("d sample"))).toBe(false);
  });

  test("truncates an excerpt to the char budget", () => {
    const out = pickExemplars([sample("a", "x".repeat(1000))], 1, 120);
    expect(out[0]).toHaveLength(120);
  });

  test("returns [] for an empty corpus", () => {
    expect(pickExemplars([])).toEqual([]);
  });

  test("is deterministic across calls (stable re-trains)", () => {
    const samples = [sample("a", "one two three\n\nlong paragraph wins here")];
    expect(pickExemplars(samples)).toEqual(pickExemplars(samples));
  });
});

test.describe("composeStyleProfile", () => {
  test("returns the bare profile when there are no exemplars", () => {
    expect(composeStyleProfile("  Write plainly.  ", [])).toBe("Write plainly.");
  });

  test("appends numbered exemplar passages under a guidance header", () => {
    const out = composeStyleProfile("Write plainly.", ["passage one", "passage two"]);
    expect(out).toContain("Write plainly.");
    expect(out).toContain("EXEMPLAR PASSAGES");
    expect(out).toContain("Example 1:\npassage one");
    expect(out).toContain("Example 2:\npassage two");
  });
});
