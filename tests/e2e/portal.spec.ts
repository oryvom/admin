import { expect, test } from "@playwright/test";

test("login page shows the company and brand", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("ORYVOM MOBILITY PRIVATE LIMITED").first()).toBeVisible();
  await expect(page.getByText("ORYVOM", { exact: true }).first()).toBeVisible();
});

test("login form rejects an invalid identifier in the browser", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("not-an-email");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("Enter a valid email address or phone number.")).toBeVisible();
});

test("a login request does not reveal configuration", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("person@example.com");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("alert").or(page.getByText("If an account matches"))).toBeVisible();
  await expect(page.locator("body")).not.toContainText("postgres");
  await expect(page.locator("body")).not.toContainText("DATABASE_URL");
  await expect(page.locator("body")).not.toContainText("SMTP_PASSWORD");
});

test("anonymous visitors are sent from protected pages to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/company-data/administration");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/company-data/offices");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/shipments");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/shipments/tracking");
  await expect(page).toHaveURL(/\/login/);
});

test("protected apis reject anonymous requests", async ({ request }) => {
  const me = await request.get("/api/me");
  expect(me.status()).toBe(401);
  const users = await request.get("/api/users");
  expect(users.status()).toBe(401);
  const transit = await request.post("/api/shipments/rate", { data: {} });
  expect([401, 403]).toContain(transit.status());
  const tracking = await request.post("/api/shipments/track", { data: {} });
  expect([401, 403]).toContain(tracking.status());
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
});

test("responses include frame protection and nosniff", async ({ page }) => {
  const response = await page.goto("/login");
  const headers = response?.headers() ?? {};
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["cache-control"]).toContain("private");
});

test("login remains usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  await expect(page.getByLabel("Email or phone")).toBeVisible();
});

test.describe("authenticated portal", () => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_OTP_CODE, "Requires a bootstrapped account and a delivered sign-in code.");

  test("dashboard cards open users and company data", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or phone").fill(process.env.E2E_ADMIN_EMAIL ?? "");
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByLabel("Sign-in code").fill(process.env.E2E_OTP_CODE ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("button", { name: /Users/ }).click();
    await page.getByRole("link", { name: /Manage Users/ }).click();
    await expect(page).toHaveURL(/\/users/);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Company Data/ }).click();
    await page.getByRole("link", { name: /Administration/ }).click();
    await expect(page.getByRole("heading", { name: "No administration records" })).toBeVisible();
    await page.goto("/company-data/offices");
    await expect(page.getByRole("heading", { name: "No office records" })).toBeVisible();
    await page.getByRole("button", { name: /Manjeet|Super Admin|menu/i }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
