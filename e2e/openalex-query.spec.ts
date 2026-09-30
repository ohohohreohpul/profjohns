import { test, expect } from "@playwright/test";
import { toOpenAlexSearch } from "../src/lib/openalex-query";

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
