import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

const adminEmail = process.env.ACCOUNT_SMOKE_ADMIN_EMAIL ?? "";
const adminPassword = process.env.ACCOUNT_SMOKE_ADMIN_PASSWORD ?? "";
const runId = process.env.ACCOUNT_SMOKE_RUN_ID ?? "manual";
const artifactDir = process.env.ACCOUNT_SMOKE_ARTIFACT_DIR ?? path.join("test-results", "account-smoke", runId);
const smokeClientIp = process.env.ACCOUNT_SMOKE_CLIENT_IP ?? "198.51.100.78";

test.use({
  viewport: MOBILE_VIEWPORT,
  isMobile: true,
  hasTouch: true,
});

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(metrics.documentWidth, "document must not overflow horizontally").toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bodyWidth, "body must not overflow horizontally").toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function expectMinTapSize(locator: Locator, label: string, min = 44) {
  await expect(locator, `${label} should be visible before measuring`).toBeVisible();
  const box = await locator.boundingBox();

  expect(box, `${label} must have a measurable bounding box`).not.toBeNull();
  expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(min);
  expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(min);
}

async function screenshot(page: Page, fileName: string) {
  mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({ path: path.join(artifactDir, fileName), fullPage: true });
}

async function loginAdmin(page: Page) {
  const loginResponse = await page.request.post("/api/auth/login", {
    headers: { "x-forwarded-for": smokeClientIp },
    data: { email: adminEmail, password: adminPassword },
  });
  expect(loginResponse.status(), "admin login response").toBe(200);
  const payload = await loginResponse.json();
  expect(payload.requiresTwoFactor, "smoke admin must not require 2FA").not.toBe(true);
  expect(payload.role, "smoke admin role").toBe("ADMIN");
}

test.describe("authenticated mobile admin lite smoke", () => {
  test.skip(!adminEmail || !adminPassword, "ACCOUNT_SMOKE_ADMIN_EMAIL and ACCOUNT_SMOKE_ADMIN_PASSWORD are required.");

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("PWA app exposes the admin cockpit with mobile-safe targets", async ({ page }) => {
    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator(".pwa-app-header")).toBeVisible();
    await expect(page.locator(".pwa-app-nav:visible a")).toHaveCount(5);
    await expectMinTapSize(page.locator(".pwa-app-nav:visible a").first(), "app mobile nav first item");
    await expect(page.getByRole("link", { name: /^Admin$/i })).toHaveAttribute("href", "/admin");
    await expectMinTapSize(page.getByRole("link", { name: /^Admin$/i }), "admin header link");
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "admin-lite-app.png");
  });

  test("core admin pages remain reachable on mobile", async ({ page }) => {
    const pages = [
      { route: "/admin", title: /admin|tableau/i, file: "admin-dashboard.png" },
      { route: "/admin/orders", title: /commandes|orders/i, file: "admin-orders.png" },
      { route: "/admin/support", title: /support/i, file: "admin-support.png" },
      { route: "/admin/delivery/runs", title: /tourn|runs/i, file: "admin-runs.png" },
    ];

    for (const item of pages) {
      await page.goto(item.route);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("heading", { name: item.title }).first()).toBeVisible();
      if (item.route === "/admin") {
        const adminMenuButton = page.locator(".admin-mobile-menu-button").first();
        await expect(adminMenuButton).toBeVisible();
        await adminMenuButton.click();
        await expect(page.locator('.admin-mobile-drawer__link[href="/admin/delivery/runs"]').first()).toBeVisible();
        await expectMinTapSize(page.locator(".admin-mobile-drawer__link").first(), "admin drawer first link");
        await page.screenshot({ path: path.join(artifactDir, "admin-mobile-drawer.png"), fullPage: true });
        await page.keyboard.press("Escape");
        await expect(page.locator(".admin-mobile-drawer--open")).toHaveCount(0);
      }
      await expectNoHorizontalOverflow(page);
      await screenshot(page, item.file);
    }
  });
});
