import { test, expect, type Page } from "@playwright/test";

/**
 * v2 board (docs/REBUILD.md Phase 2): walls of cards. Providers, AI and Jev
 * are stubbed so the journey is deterministic. Local mode uses the in-memory
 * repository; production uses Supabase (verified separately, signed in).
 */

const PAPERS = [
  { id: "W1", title: "Inferno: A guide to field experiments in online display advertising", authors: "Garrett A. Johnson", venue: "JEMS", year: 2023, abstract: "Display ad effects are tiny." },
  { id: "W2", title: "Customer acquisition via display advertising using multi-armed bandit experiments", authors: "Eric M. Schwartz, Bradlow, Fader", venue: "Marketing Science", year: 2017, abstract: "Bandits beat A/B tests." },
  { id: "W3", title: "An unrelated paper about soil chemistry", authors: "A. Person", venue: "Soil", year: 2019, abstract: "Soil." },
];
// Jev relevance per paper (order of the pool): two strong, one weak.
const SCORES = [88, 81, 12];

async function stubResearchApis(page: Page) {
  await page.route("**/api/openalex**", (r) => r.fulfill({ json: { success: true, data: PAPERS, error: null } }));
  await page.route("**/api/ai**", (r) => r.fulfill({ status: 502, json: { success: false, data: null, error: "AI off in e2e" } }));
  await page.route("**/api/jev", (r) => r.fulfill({ json: { success: true, data: SCORES, error: null, configured: true } }));
}

const wall = (page: Page, title: string) => page.locator("section", { has: page.getByRole("heading", { name: title, exact: true }) });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("profjohns-preloader-shown", "1");
    } catch {
      /* preloader just plays */
    }
  });
  await stubResearchApis(page);
  await page.goto(`/board?project=p-e2e-board&canvas=cv-e2e-board-${Date.now()}`);
  await expect(page.getByRole("heading", { name: "Sources", exact: true })).toBeVisible({ timeout: 20_000 });
});

test("walls follow the research flow", async ({ page }) => {
  const titles = await page.locator("section h2").allInnerTexts();
  expect(titles).toEqual(["Question", "Sources", "Reading", "Insights", "Themes", "Draft"]);
});

test("question -> search -> keep -> move to Reading -> note", async ({ page }) => {
  // Question
  await page.getByRole("button", { name: "Write your research question" }).click();
  const q = page.getByRole("textbox", { name: "Research question" });
  await q.fill("Do bandit experiments beat A/B tests for display advertising?");
  await q.blur();

  // The search follows the question
  const search = page.getByRole("textbox", { name: "Search for papers" });
  await expect(search).toHaveValue("Do bandit experiments beat A/B tests for display advertising?");
  await page.getByRole("button", { name: "Find papers" }).click();

  const sources = wall(page, "Sources");
  await expect(sources.getByRole("article")).toHaveCount(3, { timeout: 20_000 });
  // Kept (strong) papers come first; the weak one is New.
  await expect(sources.getByRole("article").first()).toContainText("Inferno");
  await expect(sources.getByRole("article").last()).toContainText("soil chemistry");
  await expect(sources.getByRole("article").last()).toContainText("New");

  // Keep the New paper
  await sources.getByRole("article").last().getByRole("button", { name: "Keep" }).click();
  await expect(sources.getByText("New", { exact: true })).toHaveCount(0);

  // Move a paper to Reading via the card menu (keyboard-reachable path)
  await sources.getByRole("article").first().getByRole("button", { name: "Paper card options" }).click();
  await page.getByRole("menuitem", { name: "Move to Reading" }).click();
  await expect(wall(page, "Reading").getByRole("article")).toHaveCount(1);
  await expect(wall(page, "Reading")).toContainText("Inferno");
  await expect(sources.getByRole("article")).toHaveCount(2);

  // Add a note to Insights
  await wall(page, "Insights").getByRole("button", { name: "Add note" }).click();
  await expect(wall(page, "Insights").getByRole("textbox", { name: "Note" })).toBeVisible();
});
