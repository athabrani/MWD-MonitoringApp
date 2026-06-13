import { expect, test } from "@playwright/test";

test.describe("MWD Monitoring App", () => {
  test("frontend dapat dibuka", async ({ page }) => {
    const response = await page.goto("/");

    expect(response).not.toBeNull();
    expect(response?.ok()).toBeTruthy();

    await expect(page.locator("body")).toBeVisible();
  });
});
