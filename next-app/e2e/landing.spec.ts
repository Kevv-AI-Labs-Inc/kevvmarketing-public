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

test("landing page renders primary entry points @smoke", async ({ page, context, baseURL }) => {
  await setLocaleCookie(context, baseURL, "zh");
  await page.goto("/");

  await expect(page).toHaveTitle(/Kevv Marketing/);
  await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "免费开始" }).first()).toBeVisible();
  await expect(page.getByText("Kevv", { exact: true }).first()).toBeVisible();
});
