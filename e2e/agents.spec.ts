import { test, expect } from "@playwright/test";

/**
 * The /agents surface must: seed the built-in archetypes, create a custom
 * agent (opening the editor), persist an edit, and delete a custom agent.
 * This exercises the agent store end-to-end through the browser (localStorage).
 * Auth is disabled in the test env, so /agents is reachable without a session.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("profjohns-preloader-shown", "1");
    } catch {
      /* noop */
    }
  });
  await page.goto("/agents", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible({
    timeout: 20_000,
  });
});

test("seeds the five built-in archetypes", async ({ page }) => {
  for (const key of ["scout", "synthesizer", "stylist", "citationist", "assistant"]) {
    await expect(page.getByTestId(`agent-card-builtin-${key}`)).toBeVisible();
  }
});

test("create → edit → delete a custom agent", async ({ page }) => {
  // Create: opens the editor on a fresh custom agent.
  await page.getByTestId("agent-new").click();
  const nameInput = page.getByTestId("agent-editor-name");
  await expect(nameInput).toBeVisible();

  await nameInput.fill("Methodology Critic");
  await page.getByTestId("agent-editor-prompt").fill("You critique study methodology.");
  await page.getByTestId("agent-editor-save").click();

  // The new card shows the saved name and is marked Custom.
  const card = page.locator('[data-testid^="agent-card-agent-"]').filter({
    hasText: "Methodology Critic",
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Custom");

  // Delete it via its editor.
  await card.getByRole("button", { name: "Configure" }).click();
  await page.getByTestId("agent-editor-delete").click();
  await expect(
    page.locator('[data-testid^="agent-card-agent-"]').filter({
      hasText: "Methodology Critic",
    }),
  ).toHaveCount(0);
});

test("built-in agents cannot be deleted — only reset", async ({ page }) => {
  await page.getByTestId("agent-configure-builtin-scout").click();
  await expect(page.getByTestId("agent-editor-reset")).toBeVisible();
  await expect(page.getByTestId("agent-editor-delete")).toHaveCount(0);
});
