import { expect, test } from "@playwright/test";

test("login page renders auth hub shell @smoke", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveTitle(/Kevv Marketing/);
  await expect(page.getByText("Kevv Marketing").first()).toBeVisible();
  await expect(page.getByText("Google").first()).toBeVisible();
});

test("privacy page renders Chinese legal copy @smoke", async ({ page }) => {
  await page.goto("/privacy");

  await expect(page.getByRole("heading", { name: "隐私政策" })).toBeVisible();
  await expect(page.getByText("法律信息")).toBeVisible();
});

test("terms page renders Chinese legal copy @smoke", async ({ page }) => {
  await page.goto("/terms");

  await expect(page.getByRole("heading", { name: "服务条款" })).toBeVisible();
  await expect(page.getByText("法律信息")).toBeVisible();
});
