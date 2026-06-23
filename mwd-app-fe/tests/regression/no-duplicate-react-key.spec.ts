// @ts-nocheck
import { expect, test } from "@playwright/test";

const duplicateKeyWarning = "Encountered two children with the same key";

async function loginIfNeeded(page) {
  await page.goto("/login");

  const username = page.getByLabel(/username|email/i);
  if (!(await username.isVisible().catch(() => false))) {
    return;
  }

  await username.fill(process.env.MWD_E2E_USERNAME ?? "admin");
  await page.getByLabel(/password/i).fill(process.env.MWD_E2E_PASSWORD ?? "admin12345");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function visitAndSettle(page, path) {
  await page.goto(path);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1_000);
}

test("DepthScale does not emit duplicate React key warnings on dashboard and well plot", async ({
  page,
}) => {
  const duplicateKeyWarnings = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes(duplicateKeyWarning)) {
      duplicateKeyWarnings.push(text);
    }
  });

  await loginIfNeeded(page);
  await visitAndSettle(page, "/dashboard");
  await visitAndSettle(page, "/trajectory/well-plot");

  expect(duplicateKeyWarnings).toEqual([]);
});
