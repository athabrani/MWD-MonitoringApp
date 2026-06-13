
import { expect, test, type Page } from "@playwright/test";

async function openCleanLoginPage(page: Page) {
  await page.goto("/");

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.reload();
}

function getLoginForm(page: Page) {
  const usernameInput = page
    .locator(
      [
        'input#username',
        'input[name="username"]',
        'input[name="identifier"]',
        'input[name="email"]',
        'input[autocomplete="username"]',
        'input[type="text"]',
      ].join(", ")
    )
    .first();

  // Selector dibuat spesifik agar tidak memilih tombol "Show password".
  const passwordInput = page.locator(
    'input#password, input[name="password"], input[type="password"]'
  ).first();

  const submitButton = page
    .locator('button[type="submit"]')
    .first();

  return {
    usernameInput,
    passwordInput,
    submitButton,
  };
}

async function fillLoginForm(
  page: Page,
  username: string,
  password: string
) {
  const form = getLoginForm(page);

  await expect(form.usernameInput).toBeVisible();
  await expect(form.passwordInput).toBeVisible();
  await expect(form.submitButton).toBeVisible();

  await form.usernameInput.fill(username);
  await form.passwordInput.fill(password);

  return form;
}

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await openCleanLoginPage(page);
  });

  test("admin dapat login", async ({ page }) => {
    const username = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;

    if (!username || !password) {
      throw new Error(
        "E2E_USERNAME dan E2E_PASSWORD belum disetel pada terminal Playwright."
      );
    }

    const form = await fillLoginForm(page, username, password);

    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/login") &&
        response.request().method() === "POST"
    );

    await form.submitButton.click();

    const loginResponse = await loginResponsePromise;
    const responseBody = await loginResponse.text();

    console.log("Valid login status:", loginResponse.status());
    console.log("Valid login response:", responseBody);
    console.log("URL setelah login:", page.url());

    expect(loginResponse.status()).toBe(200);

    // Login dianggap berhasil jika form login menghilang
    // atau teks Dashboard sudah tampil.
    await expect
      .poll(
        async () => {
          const loginButtonVisible = await form.submitButton
            .isVisible()
            .catch(() => false);

          const dashboardVisible = await page
            .getByText(/dashboard/i)
            .first()
            .isVisible()
            .catch(() => false);

          return !loginButtonVisible || dashboardVisible;
        },
        {
          timeout: 15_000,
          message:
            "Backend mengembalikan 200, tetapi frontend tidak berpindah dari halaman login.",
        }
      )
      .toBe(true);
  });

  test("password salah ditolak", async ({ page }) => {
    const username = process.env.E2E_USERNAME ?? "admin";

    const form = await fillLoginForm(
      page,
      username,
      "wrong-password-for-e2e-test"
    );

    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/login") &&
        response.request().method() === "POST"
    );

    await form.submitButton.click();

    const loginResponse = await loginResponsePromise;
    const responseBody = await loginResponse.text();

    console.log("Invalid login status:", loginResponse.status());
    console.log("Invalid login response:", responseBody);

    expect(loginResponse.status()).toBe(401);

    // Setelah login gagal, form harus tetap tersedia.
    await expect(form.usernameInput).toBeVisible();
    await expect(form.passwordInput).toBeVisible();
    await expect(form.submitButton).toBeVisible();
  });
});

