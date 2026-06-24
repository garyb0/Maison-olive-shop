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
    variants?: Array<{
      id: string;
      stock?: number;
      isActive?: boolean;
    }>;
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
  const product = payload.products?.find((item) => {
    const variantInStock = item.variants?.some((variant) => variant.isActive !== false && (variant.stock ?? 0) > 0);
    return item.isActive !== false && (variantInStock || (item.stock ?? 0) > 0);
  });
  expect(product?.id, "a visible in-stock product is required for solid mobile checkout").toBeTruthy();
  return product!;
}

function getCartLine(product: NonNullable<ProductsPayload["products"]>[number]) {
  const variant = product.variants?.find((item) => item.isActive !== false && (item.stock ?? 0) > 0);
  return variant ? { productId: product.id, variantId: variant.id, quantity: 1 } : { productId: product.id, quantity: 1 };
}

test.describe("solid mobile release recipe", () => {
  test("public, app, account and admin surfaces are mobile-stable", async ({ page }, testInfo) => {
    const routes = [
      { path: "/?home=1", name: "01-home", heading: /Boutique animalière locale|Local pet shop/i, tapTarget: ".home-hero-primary" },
      { path: "/boutique", name: "02-boutique", heading: /Catalogue|Catalog/i, tapTarget: ".catalog-cat-pill" },
      { path: "/faq", name: "03-faq", heading: /Comment peut-on|How can we help/i, tapTarget: ".help-anchor-nav a" },
      {
        path: "/cart",
        name: "04-cart",
        heading: /panier|cart/i,
        tapTarget: ".pwa-app-header a[href='/cart'], .pwa-app-nav a",
      },
      { path: "/account", name: "05-account-guard", heading: /Connecte-toi|Sign in/i, tapTarget: ".account-access-actions .btn" },
      { path: "/admin", name: "06-admin-guard", heading: /Administration|Admin/i, tapTarget: ".btn, .admin-mobile-menu-button" },
      { path: "/app", name: "07-app", heading: /Bienvenue|Welcome/i, tapTarget: ".pwa-app-header__brand" },
    ];

    let publicHeaderHeight: number | null = null;

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const publicHeader = page.locator(".nav-marketplace").first();
      if ((await publicHeader.count()) && (await publicHeader.isVisible())) {
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

    await expect(page.locator(".nav-marketplace").first()).toBeHidden();
    await expect(page.locator(".pwa-app-header")).toBeVisible();
  });

  test("product, cart and checkout keep the purchase path readable", async ({ page }, testInfo) => {
    const product = await firstAvailableProduct(page);

    await page.goto(`/products/${product.slug}`);
    await page.waitForLoadState("domcontentloaded");
    await expectNoHorizontalOverflow(page);
    await expect(page.locator(".olive-product-add-btn").first()).toBeVisible();
    await expectMinTapSize(page.locator(".olive-product-add-btn").first(), "product add button");
    const productAddBox = await page.locator(".olive-product-add-btn").first().boundingBox();
    expect(productAddBox, "product add button should be measurable").not.toBeNull();
    expect(productAddBox!.y, "product add button should appear in the first mobile screen").toBeLessThan(MOBILE_VIEWPORT.height);
    await expect(page.locator(".olive-product-trust-grid")).toContainText(/Livraison locale|Livraison à domicile|Local delivery|Home delivery/i);
    await capture(page, testInfo, "08-product");

    await page.evaluate((line) => {
      window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([line]));
    }, getCartLine(product));

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
    await expect(page.getByRole("heading", { name: /Bienvenue|Welcome/i })).toBeVisible();
    await expect(page.locator("a[href^='/login']").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Centre d'actions" })).toHaveCount(0);
    await expect(page.locator(".pwa-core-action-grid a, .pwa-core-action-grid button")).toHaveCount(4);
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "11-app-install-optional-public");
  });

  test("native boutique shows the compact app product list", async ({ page }, testInfo) => {
    await page.goto("/boutique?native=1");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("html")).toHaveAttribute("data-native-app", "chezolive");
    await expectNoHorizontalOverflow(page);

    const cards = page.locator(".catalog-product-card");
    const cardCount = await cards.count();
    expect(cardCount, "native boutique should render at least one product card").toBeGreaterThan(0);

    const firstCard = cards.nth(0);
    await expect(firstCard).toBeVisible();

    if (cardCount > 1) {
      const secondCard = cards.nth(1);
      await expect(secondCard).toBeVisible();

      const [firstBox, secondBox] = await Promise.all([firstCard.boundingBox(), secondCard.boundingBox()]);
      expect(firstBox, "first product card box").not.toBeNull();
      expect(secondBox, "second product card box").not.toBeNull();
      expect(secondBox!.y, "second product should stack below first product").toBeGreaterThan(firstBox!.y + firstBox!.height * 0.75);
      expect(Math.abs(firstBox!.x - secondBox!.x), "product cards should share the same list column").toBeLessThanOrEqual(4);
    }

    await expect(firstCard.locator(".catalog-stock-pill")).toBeVisible();
    await expect(firstCard.locator(".catalog-product-price")).toBeVisible();
    await expect(firstCard.locator(".catalog-product-seller")).toBeHidden();
    await expect(firstCard.locator(".catalog-product-rating")).toBeHidden();
    await expect(firstCard.locator(".catalog-product-fast-note")).toBeHidden();
    await expect(firstCard.locator(".catalog-product-view")).toBeHidden();
    await expect(firstCard.locator(".catalog-product-secondary-actions")).toBeHidden();
    await expectMinTapSize(firstCard.locator(".catalog-product-add"), "native boutique add button");

    await capture(page, testInfo, "12-native-boutique-compact-list");
  });
});
