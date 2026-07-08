import { test, expect } from "@playwright/test";

/**
 * The /account surface must mount and render inside the workspace shell.
 * The test server runs with Supabase blanked (auth disabled), so this
 * exercises the local-mode branch — the signed-in profile/security forms
 * require a real session and are covered by manual/staging QA.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("profjohns-preloader-shown", "1");
    } catch {
      /* noop */
    }
  });
});

test("/account renders the account surface (local mode)", async ({ page }) => {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible({
    timeout: 20_000,
  });
  // Auth disabled in the test env → the local-mode card, not a redirect.
  await expect(page.getByText("Running in local mode")).toBeVisible();
});
