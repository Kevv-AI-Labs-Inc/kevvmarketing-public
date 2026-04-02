import { expect, test } from "@playwright/test";

async function setLocaleCookie(
  context: import("@playwright/test").BrowserContext,
  baseURL: string | undefined,
  locale: "zh" | "en",
) {
  await context.addCookies([
    {
      name: "kevv-locale",
      value: locale,
      url: baseURL ?? "http://127.0.0.1:3210",
    },
  ]);
}

test("landing primary CTA opens the login hub @critical", async ({ page, context, baseURL }) => {
  await setLocaleCookie(context, baseURL, "zh");
  await page.goto("/");

  await page.getByRole("link", { name: "免费开始" }).first().click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Kevv Marketing").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /使用 Google 继续/ }).first()).toBeVisible();
});

test("landing locale toggle switches to English and persists after reload @critical", async ({ page, context, baseURL }) => {
  await setLocaleCookie(context, baseURL, "zh");
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

test("login locale toggle updates provider copy @critical", async ({ page, context, baseURL }) => {
  await setLocaleCookie(context, baseURL, "zh");
  await page.goto("/login");

  await expect(page.getByRole("button", { name: /使用 Google 继续/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "切换语言" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: /Continue with Google/ }).first()).toBeVisible();
  await expect(page.getByText("Choose Google, Microsoft, or request a one-time email sign-in link.")).toBeVisible();
});
