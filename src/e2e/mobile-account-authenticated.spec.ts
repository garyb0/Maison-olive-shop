import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const CART_STORAGE_KEY = "chezolive_cart_v1";

const email = process.env.ACCOUNT_SMOKE_EMAIL ?? "";
const password = process.env.ACCOUNT_SMOKE_PASSWORD ?? "";
const runId = process.env.ACCOUNT_SMOKE_RUN_ID ?? "manual";
const artifactDir = process.env.ACCOUNT_SMOKE_ARTIFACT_DIR ?? path.join("test-results", "account-smoke", runId);
const orderNumber = process.env.ACCOUNT_SMOKE_ORDER_NUMBER ?? "";
const dogName = process.env.ACCOUNT_SMOKE_DOG_NAME ?? "";
const dogToken = process.env.ACCOUNT_SMOKE_DOG_TOKEN ?? "";
const productId = process.env.ACCOUNT_SMOKE_PRODUCT_ID ?? "";
const smokeClientIp = process.env.ACCOUNT_SMOKE_CLIENT_IP ?? "198.51.100.77";

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

async function expectNoClientQrSurface(page: Page) {
  await expect(page.locator('a[href="/account/dogs"]')).toHaveCount(0);
  await expect(
    page.getByText(/Chiens QR|Dog QR|collier QR|QR collar|profil QR|QR profile|G.rer mes chiens|Manage my dogs|G.rer cette fiche|Manage this profile/i),
  ).toHaveCount(0);
}

async function screenshot(page: Page, fileName: string) {
  mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({ path: path.join(artifactDir, fileName), fullPage: true });
}

async function loginCustomer(page: Page) {
  const loginResponse = await page.request.post("/api/auth/login", {
    headers: { "x-forwarded-for": smokeClientIp },
    data: { email, password },
  });
  expect(loginResponse.status(), "customer login response").toBe(200);
  const payload = await loginResponse.json();
  expect(payload.requiresTwoFactor, "smoke customer must not require 2FA").not.toBe(true);

  await page.goto("/account");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator(".account-layout-shell")).toBeVisible();
}

async function openAccountPage(page: Page, route: string, title: RegExp) {
  await page.goto(route);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page.locator(".account-mobile-account-nav")).toHaveCount(0);
  await expect(page.locator(".pwa-app-nav:visible")).toHaveCount(1);
  await expectMinTapSize(page.locator(".pwa-app-nav:visible a").first(), "app mobile nav first item");
}

test.describe("authenticated mobile account smoke", () => {
  test.skip(!email || !password, "ACCOUNT_SMOKE_EMAIL and ACCOUNT_SMOKE_PASSWORD are required.");

  test.beforeEach(async ({ page }) => {
    await loginCustomer(page);
  });

  test("app connected hub stays mobile-safe", async ({ page }) => {
    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator(".pwa-app-header")).toBeVisible();
    await expect(page.locator(".pwa-app-nav:visible a")).toHaveCount(5);
    await expectMinTapSize(page.locator(".pwa-app-nav:visible a").first(), "app mobile nav first item");
    await expect(page.getByRole("heading", { name: /Bonjour|Hi/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "app-client-hub.png");
  });

  test("client QR surfaces stay hidden while connected", async ({ page }) => {
    for (const route of ["/?home=1", "/app", "/account", "/boutique", "/cart"]) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await expectNoClientQrSurface(page);
      await expectNoHorizontalOverflow(page);
    }

    await page.goto("/account/dogs");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/account(?:[?#].*)?$/);
    await expectNoClientQrSurface(page);
  });

  test("dashboard and orders are visible", async ({ page }) => {
    await openAccountPage(page, "/account", /bonjour|hello/i);
    await expect(page.getByText(email)).toBeVisible();
    await expectNoClientQrSurface(page);
    await screenshot(page, "account-dashboard.png");

    await openAccountPage(page, "/account/orders", /centre de commandes|order center|mes commandes|my orders/i);
    await expectNoClientQrSurface(page);
    if (orderNumber) {
      await expect(page.getByText(orderNumber).first()).toBeVisible();
      await expectMinTapSize(page.getByRole("link", { name: /Voir le suivi|View tracking/i }).first(), "order tracking link");
    }
    await screenshot(page, "account-orders.png");

    if (dogToken && dogName) {
      await page.goto(`/dog/${encodeURIComponent(dogToken)}`);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByText(dogName).first()).toBeVisible();
      await expectNoClientQrSurface(page);
      await expectNoHorizontalOverflow(page);
      await screenshot(page, "dog-public.png");
    }
  });

  test("profile, subscriptions and support pages stay mobile-safe", async ({ page }) => {
    await openAccountPage(page, "/account/profile", /profil|profile/i);
    await expectMinTapSize(page.locator(".account-profile-shell input").first(), "profile first input");
    await screenshot(page, "account-profile.png");

    await openAccountPage(page, "/account/subscriptions", /abonnements|subscriptions/i);
    await screenshot(page, "account-subscriptions.png");

    await openAccountPage(page, "/account/support", /messages|support/i);
    await expect(page.getByPlaceholder(/Écris ton message|Write your message/i)).toBeVisible();
    const closeTicketButton = page.getByRole("button", { name: /Fermer le billet|Close ticket/i }).first();
    if (await closeTicketButton.count()) {
      await expectMinTapSize(closeTicketButton, "support close ticket button");
    }
    await screenshot(page, "account-support.png");
  });

  test("account routes keep a single bottom navigation in native mode", async ({ page }) => {
    for (const route of ["/account", "/account/orders", "/account/support"]) {
      await page.goto(`${route}?native=1`);
      await page.waitForLoadState("domcontentloaded");

      await expect(page.locator("html")).toHaveClass(/is-capacitor-native/);
      await expect(page.locator(".account-mobile-account-nav")).toHaveCount(0);
      await expect(page.locator(".pwa-app-nav:visible")).toHaveCount(1);
      await expect(page.locator(".native-app-tabbar")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("connected cart and checkout are readable on mobile", async ({ page }) => {
    test.skip(!productId, "ACCOUNT_SMOKE_PRODUCT_ID is required for cart and checkout screenshots.");

    await page.evaluate(
      ({ key, id }) => window.localStorage.setItem(key, JSON.stringify([{ productId: id, quantity: 1 }])),
      { key: CART_STORAGE_KEY, id: productId },
    );
    await page.goto("/cart");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".cart-loading-state")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator(".cart-item-card")).toHaveCount(1, { timeout: 30_000 });
    await expectMinTapSize(page.locator(".cart-checkout-btn").first(), "cart checkout CTA");
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "cart-connected.png");

    await page.goto("/checkout");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".checkout-step-card")).toHaveCount(4);
    await expect(page.locator(".checkout-place-order-btn").first()).toBeVisible();
    await expectMinTapSize(page.locator(".checkout-place-order-btn").first(), "checkout submit CTA");
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "checkout-connected.png");
  });
});
