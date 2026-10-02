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

test("figures in the draft: Add to draft from a card, place another from the editor, numbered, exported", async ({ page }) => {
  const insights = wall(page, "Insights");
  const makeChart = async (tsv: string) => {
    await insights.getByRole("button", { name: "Add chart" }).click();
    await insights.getByLabel("Chart data").fill(tsv);
    await insights.getByRole("button", { name: "Make chart" }).click();
  };
  await makeChart(RESULTS_TSV);
  await makeChart("epoch\tloss\n1\t0.92\n2\t0.51\n3\t0.33");
  const charts = insights.getByRole("article").filter({ hasText: "Chart" });
  await expect(charts).toHaveCount(2);
  const first = charts.first();
  await first.getByRole("textbox", { name: "Chart title" }).fill("ImageNet accuracy");
  await first.getByRole("textbox", { name: "Chart title" }).blur();

  // From the card: creates the Draft and places Figure 1.
  await first.getByRole("button", { name: "Chart card options" }).click();
  await page.getByRole("menuitem", { name: "Add to draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to the draft as Figure 1." })).toBeVisible();

  await wall(page, "Draft").getByRole("article").getByRole("button", { name: "Open editor" }).click();
  const editor = page.locator(".ProseMirror").last();
  await expect(editor).toBeVisible({ timeout: 15_000 });
  const figures = editor.locator("figure[data-figure-ref]");
  await expect(figures).toHaveCount(1);
  await expect(figures.first().getByRole("img", { name: /^Bar chart of Top-1, Params by Model/ })).toBeVisible();
  await expect(figures.first().locator("figcaption")).toHaveText("Figure 1. ImageNet accuracy.");

  // From the editor toolbar: the menu marks what's placed; the new one is Figure 2.
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.getByRole("button", { name: "Figure", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /ImageNet accuracy\s*Figure 1/ })).toBeVisible();
  await page.getByRole("menuitem", { name: "Untitled chart" }).click();
  await expect(figures).toHaveCount(2);
  await expect(figures.nth(1).getByRole("img", { name: /^Line chart of loss by epoch/ })).toBeVisible();
  await expect(figures.nth(1).locator("figcaption")).toHaveText("Figure 2.");

  // Export carries numbered captions.
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Markdown/ }).click();
  const fs = await import("node:fs/promises");
  const md = await fs.readFile((await (await download).path())!, "utf8");
  expect(md).toContain("**Figure 1.** ImageNet accuracy.");
  expect(md).toContain("**Figure 2.**");
});

test("Word export embeds each figure's picture (chart and image) above its caption", async ({ page }) => {
  const insights = wall(page, "Insights");
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 60;
    c.height = 40;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0e9f6e";
    ctx.fillRect(0, 0, 60, 40);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await insights.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "fig.png", mimeType: "image/png", buffer: Buffer.from(png) });
  const picture = insights.getByRole("article").filter({ hasText: "Figure" });
  await expect(picture.locator("img")).toBeVisible({ timeout: 15_000 });
  await insights.getByRole("button", { name: "Add chart" }).click();
  await insights.getByLabel("Chart data").fill(RESULTS_TSV);
  await insights.getByRole("button", { name: "Make chart" }).click();

  for (const label of ["Figure card options", "Chart card options"]) {
    await insights.getByRole("button", { name: label }).click();
    await page.getByRole("menuitem", { name: "Add to draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added to the draft" })).toBeVisible();
    await page.waitForTimeout(300);
  }

  await wall(page, "Draft").getByRole("article").getByRole("button", { name: "Open editor" }).click();
  await expect(page.locator(".ProseMirror figure[data-figure-ref]")).toHaveCount(2, { timeout: 15_000 });
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Word/ }).click();
  const fs = await import("node:fs/promises");
  const docx = await fs.readFile((await (await download).path())!);
  // A .docx is a zip: entry names are stored in the clear.
  const entries = docx.toString("latin1").match(/word\/media\/[\w.-]+\.png/g) ?? [];
  expect(new Set(entries).size).toBe(2);
  await expect(page.getByRole("status").filter({ hasText: "couldn't be embedded" })).toHaveCount(0);
});

test("Reader highlights save to the paper's card: counted on the card, back when reopened, removable", async ({ page }) => {
  await page.route("**/api/readable**", (r) => r.fulfill({ status: 502, json: { success: false, data: null, error: "offline in e2e" } }));
  await page.getByRole("textbox", { name: "Search for papers" }).fill("bandit experiments for display advertising");
  await page.getByRole("button", { name: "Find papers" }).click();
  const paper = wall(page, "Sources").getByRole("article").filter({ hasText: "Customer acquisition" });
  await expect(paper).toBeVisible({ timeout: 20_000 });

  const highlightFirstParagraph = async () => {
    // No full text in e2e: the Reader shows the abstract, which can be highlighted too.
    const para = page.getByText("Bandits beat A/B tests.", { exact: true });
    await expect(para).toBeVisible({ timeout: 15_000 });
    await para.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    // A scripted selection has no on-screen rect, so the toolbar sits off-screen.
    await page.getByRole("button", { name: "Highlight", exact: true }).dispatchEvent("click");
  };

  await paper.getByRole("button", { name: "Read" }).click();
  await highlightFirstParagraph();
  await expect(page.getByRole("button", { name: /Highlights\s*1/ })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).first().click();

  // Saved on the card (the board's server copy in production).
  await expect(paper).toContainText("1 highlight");

  // Reopen: the highlight is there, from the card.
  await paper.getByRole("button", { name: "Read" }).click();
  await expect(page.getByRole("button", { name: /Highlights\s*1/ })).toBeVisible({ timeout: 15_000 });
  // Regressions: the Reader must stay open on a second open (it used to replay
  // its exit animation and close itself), and the highlight must stay.
  await page.waitForTimeout(1500);
  await expect(page.getByRole("button", { name: /Highlights\s*1/ })).toBeVisible();
  await page.getByRole("button", { name: /Highlights\s*1/ }).click();
  await page.getByRole("button", { name: /remove/i }).first().click();
  await expect(page.getByRole("button", { name: /Highlights\s*1/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).first().click();
  await expect(paper).not.toContainText("highlight");
});

test("figure references in the text renumber when figures are removed, and flag a missing figure", async ({ page }) => {
  const insights = wall(page, "Insights");
  for (const tsv of [RESULTS_TSV, "epoch\tloss\n1\t0.92\n2\t0.51\n3\t0.33"]) {
    await insights.getByRole("button", { name: "Add chart" }).click();
    await insights.getByLabel("Chart data").fill(tsv);
    await insights.getByRole("button", { name: "Make chart" }).click();
  }
  const charts = insights.getByRole("article").filter({ hasText: "Chart" });
  await expect(charts).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await charts.nth(i).getByRole("button", { name: "Chart card options" }).click();
    await page.getByRole("menuitem", { name: "Add to draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: `as Figure ${i + 1}.` })).toBeVisible();
  }

  await wall(page, "Draft").getByRole("article").getByRole("button", { name: "Open editor" }).click();
  const editor = page.locator(".ProseMirror").last();
  const figures = editor.locator("figure[data-figure-ref]");
  await expect(figures).toHaveCount(2, { timeout: 15_000 });
  // Opening a draft that starts with a figure must not select it (typing
  // would replace it); click into the last paragraph and write.
  await editor.locator("p").last().click();
  await page.keyboard.type("Loss falls steadily, as shown in ");
  await page.getByRole("button", { name: "Figure", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Figure 2/ }).click();
  const ref = editor.locator("[data-figure-mention]");
  await expect(ref).toHaveText("Figure 2");

  // Figure 1 leaves the draft: the loss chart is now Figure 1, and so is the reference.
  await figures.first().getByRole("button", { name: "Remove figure from draft" }).dispatchEvent("click");
  await expect(figures).toHaveCount(1);
  await expect(figures.first().locator("figcaption")).toHaveText("Figure 1.");
  await expect(ref).toHaveText("Figure 1");

  // Its figure gone too: the reference says so instead of pointing at nothing.
  await figures.first().getByRole("button", { name: "Remove figure from draft" }).dispatchEvent("click");
  await expect(ref).toHaveText("Figure ?");
  await expect(ref).toHaveAttribute("title", /no longer in the draft/);

  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Plain text/ }).click();
  const fs = await import("node:fs/promises");
  expect(await fs.readFile((await (await download).path())!, "utf8")).toContain("as shown in Figure ?");
});
