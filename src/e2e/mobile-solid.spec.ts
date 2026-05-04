import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const runId = process.env.SOLID_RELEASE_RUN_ID ?? "manual";
const artifactDir = process.env.SOLID_RELEASE_ARTIFACT_DIR
  ? path.resolve(process.env.SOLID_RELEASE_ARTIFACT_DIR)
  : path.join(process.cwd(), "test-results", "solid-release", runId);

type ProductsPayload = {
  products?: Array<{
    id: string;
    slug: string;
    stock?: number;
    isActive?: boolean;
  }>;
};

test.use({
  viewport: MOBILE_VIEWPORT,
  isMobile: true,
  hasTouch: true,
});

async function capture(page: Page, testInfo: TestInfo, name: string) {
  fs.mkdirSync(artifactDir, { recursive: true });
  const screenshotPath = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(name, {
    path: screenshotPath,
    contentType: "image/png",
  });
}

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

async function expectFirstVisibleMinTapSize(page: Page, selector: string, label: string, min = 44) {
  const candidates = page.locator(selector);
  const count = await candidates.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible()) {
      await expectMinTapSize(candidate, label, min);
      return;
    }
  }

  await expect(candidates.first(), `${label} should have at least one visible candidate`).toBeVisible();
}

async function firstAvailableProduct(page: Page) {
  const response = await page.request.get("/api/products");
  expect(response.ok(), "products API response").toBe(true);
  const payload = (await response.json()) as ProductsPayload;
  const product = payload.products?.find((item) => item.isActive !== false && (item.stock ?? 0) > 0);
  expect(product?.id, "a visible in-stock product is required for solid mobile checkout").toBeTruthy();
  return product!;
}

test.describe("solid mobile release recipe", () => {
  test("public, app, account and admin surfaces are mobile-stable", async ({ page }, testInfo) => {
    const routes = [
      { path: "/?home=1", name: "01-home", heading: /De notre famille/i, tapTarget: ".home-hero-primary" },
      { path: "/boutique", name: "02-boutique", heading: /Catalogue|Catalog/i, tapTarget: ".catalog-side-link" },
      { path: "/faq", name: "03-faq", heading: /Comment peut-on|How can we help/i, tapTarget: ".help-anchor-nav a" },
      { path: "/cart", name: "04-cart", heading: /panier|cart/i, tapTarget: ".nav-marketplace-cart, .nav-hamburger" },
      { path: "/account", name: "05-account-guard", heading: /Connecte-toi|Sign in/i, tapTarget: ".account-access-actions .btn" },
      { path: "/admin", name: "06-admin-guard", heading: /Administration|Admin/i, tapTarget: ".btn, .admin-mobile-menu-button" },
      { path: "/app", name: "07-app", heading: /^Chez Olive$/i, tapTarget: ".pwa-app-header__brand" },
    ];

    let publicHeaderHeight: number | null = null;

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const publicHeader = page.locator(".nav-marketplace").first();
      if (await publicHeader.count()) {
        const height = await publicHeader.evaluate((element) => element.getBoundingClientRect().height);
        if (publicHeaderHeight === null) {
          publicHeaderHeight = height;
        } else {
          expect(Math.abs(height - publicHeaderHeight), `${route.path} public header height`).toBeLessThanOrEqual(1);
        }
      }

      await expectFirstVisibleMinTapSize(page, route.tapTarget, `${route.path} primary tap target`);
      await capture(page, testInfo, route.name);
    }

    await expect(page.locator(".nav-marketplace")).toHaveCount(0);
    await expect(page.locator(".pwa-app-header")).toBeVisible();
  });

  test("product, cart and checkout keep the purchase path readable", async ({ page }, testInfo) => {
    const product = await firstAvailableProduct(page);

    await page.goto(`/products/${product.slug}`);
    await page.waitForLoadState("domcontentloaded");
    await expectNoHorizontalOverflow(page);
    await expect(page.locator(".olive-product-add-btn").first()).toBeVisible();
    await expectMinTapSize(page.locator(".olive-product-add-btn").first(), "product add button");
    await expect(page.locator(".olive-product-trust-grid")).toContainText(/Livraison locale|Local delivery/i);
    await capture(page, testInfo, "08-product");

    await page.evaluate((productId) => {
      window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId, quantity: 1 }]));
    }, product.id);

    await page.goto("/cart");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".cart-item-card")).toHaveCount(1, { timeout: 20_000 });
    await expectMinTapSize(page.locator(".cart-checkout-btn").first(), "cart checkout CTA");
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "09-cart-seeded");

    await page.goto("/checkout");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".checkout-step-card")).toHaveCount(4);
    await expect(page.locator(".checkout-place-order-btn").first()).toBeVisible();
    await expectMinTapSize(page.locator(".checkout-place-order-btn").first(), "checkout final CTA");
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "10-checkout-seeded");
  });

  test("PWA install and notification surfaces stay optional", async ({ page }, testInfo) => {
    await page.goto("/boutique");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/boutique/);

    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /^Chez Olive$/i })).toBeVisible();
    await expect(page.getByRole("region", { name: "Installer Chez Olive" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
    await expect(page.getByRole("heading", { name: "Centre d'actions" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "11-app-install-optional-public");
  });
});
