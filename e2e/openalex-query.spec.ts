import { test, expect } from "@playwright/test";
import { toOpenAlexSearch, toTitleAbstractFilter, mergeUnique } from "../src/lib/openalex-query";

/**
 * Regression: a research QUESTION typed on the home page ("...A/B tests?")
 * made OpenAlex return 400, because `?` and `*` are wildcard characters in
 * its search syntax. Found by the Jev PhD-student journey simulation.
 */
test.describe("toOpenAlexSearch", () => {
  test("strips the trailing question mark from a research question", () => {
    expect(
      toOpenAlexSearch("Does generative AI creative testing work at scale compared with A/B tests?"),
    ).toBe("Does generative AI creative testing work at scale compared with A/B tests");
  });

  test("removes wildcard characters anywhere and collapses the gaps", () => {
    expect(toOpenAlexSearch("ad* testing ?  at  scale")).toBe("ad testing at scale");
  });

  test("keeps characters OpenAlex accepts", () => {
    expect(toOpenAlexSearch(`N=1 "A/B" tests: (field) it's`)).toBe(`N=1 "A/B" tests: (field) it's`);
  });

  test("returns an empty string when only wildcards remain", () => {
    expect(toOpenAlexSearch(" ?* ")).toBe("");
  });
});

test.describe("toTitleAbstractFilter", () => {
  test("builds the precise filter and strips filter separators", () => {
    expect(toTitleAbstractFilter("creative testing, scale | ads?")).toBe(
      "title_and_abstract.search:creative testing scale ads",
    );
  });

  test("returns null when nothing searchable remains", () => {
    expect(toTitleAbstractFilter(" ,|? ")).toBeNull();
  });
});

test.describe("mergeUnique", () => {
  test("keeps precise results first, drops duplicates, caps the count", () => {
    const a = [{ id: "1" }, { id: "2" }];
    const b = [{ id: "2" }, { id: "3" }, { id: "4" }];
    expect(mergeUnique(a, b, 3).map((p) => p.id)).toEqual(["1", "2", "3"]);
  });
});
