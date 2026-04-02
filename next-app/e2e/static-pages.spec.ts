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

test("login page renders auth hub shell @smoke", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveTitle(/Kevv Marketing/);
  await expect(page.getByText("Kevv Marketing").first()).toBeVisible();
  await expect(page.getByText("Google").first()).toBeVisible();
});

test("privacy page renders Chinese legal copy @smoke", async ({ page, context, baseURL }) => {
  await setLocaleCookie(context, baseURL, "zh");
  await page.goto("/privacy");

  await expect(page.getByRole("heading", { name: "隐私政策" })).toBeVisible();
  await expect(page.getByText("法律信息")).toBeVisible();
});

test("terms page renders Chinese legal copy @smoke", async ({ page, context, baseURL }) => {
  await setLocaleCookie(context, baseURL, "zh");
  await page.goto("/terms");

  await expect(page.getByRole("heading", { name: "服务条款" })).toBeVisible();
  await expect(page.getByText("法律信息")).toBeVisible();
});
