import { test, expect } from "@playwright/test";
import { fallbackProvider } from "../src/lib/scout";

/**
 * Regression (prod, 2026-10-02): the AI routed every angle to Semantic
 * Scholar, which was rate limiting (429), so the whole search failed even
 * though OpenAlex was up. A failed index must fall back to another one.
 */
test("a failed index falls back to OpenAlex when allowed", () => {
  expect(fallbackProvider("semanticscholar", new Set(["semanticscholar"]))).toBe("openalex");
  expect(fallbackProvider("arxiv", new Set(["arxiv"]), ["arxiv", "openalex"])).toBe("openalex");
});

test("falls back only to indexes the board allows and that aren't down", () => {
  expect(fallbackProvider("arxiv", new Set(["arxiv"]), ["arxiv"])).toBeNull();
  expect(fallbackProvider("arxiv", new Set(["arxiv"]), ["arxiv", "semanticscholar"])).toBe("semanticscholar");
  expect(fallbackProvider("openalex", new Set(["openalex", "semanticscholar"]))).toBe("arxiv");
});
