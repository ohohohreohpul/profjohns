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

test("theme -> start draft (outline from themes) -> write in the editor -> saved to the card", async ({ page }) => {
  await page.getByRole("button", { name: "Write your research question" }).click();
  const q = page.getByRole("textbox", { name: "Research question" });
  await q.fill("Do bandit experiments beat A/B tests?");
  await q.blur();

  await wall(page, "Themes").getByRole("button", { name: "New theme" }).click();
  const themeName = wall(page, "Themes").getByRole("textbox", { name: "Theme name" });
  await themeName.fill("Bandits learn faster");
  await themeName.blur();
  await expect(wall(page, "Themes")).toContainText("Drop insights here");

  await wall(page, "Draft").getByRole("button", { name: "Start the draft" }).click();
  const draft = wall(page, "Draft").getByRole("article");
  await expect(draft).toContainText("Do bandit experiments beat A/B tests?");
  await expect(draft).toContainText("Bandits learn faster");
  await expect(draft).toContainText("Empty draft");

  await draft.getByRole("button", { name: "Open editor" }).click();
  const editor = page.locator(".ProseMirror").last();
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  await page.keyboard.type("Bandit allocation shifts traffic toward winners during the test.");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /close/i }).last().click();

  await expect(draft).toContainText("9 words", { timeout: 10_000 });
});

test("add an image to a wall -> Figure card with an editable caption", async ({ page }) => {
  // A real 40x30 PNG (blue), so the browser can decode and downscale it.
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 30;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(0, 0, 40, 30);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await wall(page, "Insights")
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: Buffer.from(png) });

  const figure = wall(page, "Insights").getByRole("article").filter({ hasText: "Figure" });
  await expect(figure).toHaveCount(1, { timeout: 15_000 });
  const img = figure.locator("img");
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(40);

  const caption = figure.getByRole("textbox", { name: "Figure caption" });
  await caption.fill("Figure 1. Conversion by test arm.");
  await caption.blur();
  await expect(caption).toHaveValue("Figure 1. Conversion by test arm.");
});

const RESULTS_TSV = "Model\tTop-1\tParams\nViT-B\t81.8\t86\nMLP-Mixer\t76.4\t59\nResMLP\t79.4\t30";

test("paste a table into Add chart -> bar chart with series, data table, type switch, edit data", async ({ page }) => {
  const insights = wall(page, "Insights");
  await insights.getByRole("button", { name: "Add chart" }).click();
  const data = insights.getByLabel("Chart data");
  await data.fill("just words");
  await expect(insights.getByRole("status")).toContainText("doesn't look like a table");
  await expect(insights.getByRole("button", { name: "Make chart" })).toBeDisabled();
  await data.fill(RESULTS_TSV);
  await expect(insights.getByRole("status")).toContainText("3 columns, 3 rows: makes a bar chart");
  await insights.getByRole("button", { name: "Make chart" }).click();

  const card = insights.getByRole("article").filter({ hasText: "Chart" });
  await expect(card.getByRole("img", { name: /Bar chart of Top-1, Params by Model, 3 rows, values from 30 to 86/ })).toBeVisible();
  await expect(card.locator("svg[role=img] rect")).toHaveCount(6);
  await expect(card.getByRole("list", { name: "Series" }).getByRole("listitem")).toHaveText(["Top-1", "Params"]);

  // The data table is the chart's accessible equivalent.
  await card.getByRole("button", { name: "Show data" }).click();
  await expect(card.getByRole("table").getByRole("row")).toHaveCount(4);
  await expect(card.getByRole("cell", { name: "76.4" })).toBeVisible();

  await card.getByRole("button", { name: "Line", exact: true }).click();
  await expect(card.getByRole("button", { name: "Line", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("img", { name: /^Line chart/ })).toBeVisible();

  await card.getByRole("textbox", { name: "Chart title" }).fill("ImageNet accuracy");
  await card.getByRole("textbox", { name: "Chart title" }).blur();

  // Edit data: one more row; the chosen type and title survive.
  await card.getByRole("button", { name: "Chart card options" }).click();
  await page.getByRole("menuitem", { name: "Edit data" }).click();
  await card.getByLabel("Chart data").fill(`${RESULTS_TSV}\ngMLP\t81.6\t73`);
  await card.getByRole("button", { name: "Save data" }).click();
  await expect(card.getByRole("img", { name: /^Line chart of Top-1, Params by Model, 4 rows/ })).toBeVisible();
  await expect(card.getByRole("textbox", { name: "Chart title" })).toHaveValue("ImageNet accuracy");
});

test("paste spreadsheet cells on the board -> Chart card in Insights; prose paste does nothing", async ({ page }) => {
  const paste = (text: string) =>
    page.evaluate((t) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", t);
      window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
    }, text);
  await paste("Hello, world.\nThis is a sentence, with commas.");
  await page.waitForTimeout(300);
  await expect(wall(page, "Insights").getByRole("article")).toHaveCount(0);

  await paste("epoch\tloss\n1\t0.92\n2\t0.51\n3\t0.33");
  await expect(page.getByRole("status").filter({ hasText: "Chart added to Insights" })).toBeVisible();
  await expect(wall(page, "Insights").getByRole("img", { name: /^Line chart of loss by epoch, 3 rows/ })).toBeVisible();
});
