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

async function loginCustomer(page: Page) {
  const loginResponse = await page.request.post("/api/auth/login", {
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
  await expectMinTapSize(page.locator(".account-sidebar .admin-nav-item").first(), "account nav first item");
}

test.describe("authenticated mobile account smoke", () => {
  test.skip(!email || !password, "ACCOUNT_SMOKE_EMAIL and ACCOUNT_SMOKE_PASSWORD are required.");

  test.beforeEach(async ({ page }) => {
    await loginCustomer(page);
  });

  test("dashboard, orders and dog profile are visible", async ({ page }) => {
    await openAccountPage(page, "/account", /bonjour|hello/i);
    await expect(page.getByText(email)).toBeVisible();
    await screenshot(page, "account-dashboard.png");

    await openAccountPage(page, "/account/orders", /mes commandes|my orders/i);
    if (orderNumber) {
      await expect(page.getByText(orderNumber).first()).toBeVisible();
      await expectMinTapSize(page.locator(".account-order-card__detail-link").first(), "order detail link");
    }
    await screenshot(page, "account-orders.png");

    await openAccountPage(page, "/account/dogs", /mes chiens|my dogs/i);
    if (dogName) {
      await expect(page.getByText(dogName).first()).toBeVisible();
    }
    await screenshot(page, "account-dogs.png");

    if (dogToken && dogName) {
      await page.goto(`/dog/${encodeURIComponent(dogToken)}`);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByText(dogName).first()).toBeVisible();
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

    await openAccountPage(page, "/account/support", /support client|customer support/i);
    await expectMinTapSize(page.locator(".account-main a, .account-main button").first(), "support primary action");
    await screenshot(page, "account-support.png");
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
