import { expect, test } from "@playwright/test";

test("landing primary CTA opens the login hub @critical", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "免费开始" }).first().click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Kevv Marketing").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /使用 Google 继续/ }).first()).toBeVisible();
});

test("landing locale toggle switches to English and persists after reload @critical", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.getByRole("button", { name: "切换语言" })).toBeVisible();

  await page.getByRole("button", { name: "切换语言" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
});

test("login locale toggle updates provider copy @critical", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("button", { name: /使用 Google 继续/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "切换语言" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: /Continue with Google/ }).first()).toBeVisible();
  await expect(page.getByText("Choose Google, Microsoft, or request a one-time email sign-in link.")).toBeVisible();
});
