import { expect, test } from "@playwright/test";

test("landing page renders primary entry points @smoke", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Kevv Marketing/);
  await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "免费开始" }).first()).toBeVisible();
  await expect(page.getByText("Kevv", { exact: true }).first()).toBeVisible();
});
