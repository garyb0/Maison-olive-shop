import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.use({
  viewport: { width: 393, height: 873 },
  isMobile: true,
  hasTouch: true,
});

const screenshotDir = path.join(process.cwd(), "test-results", "play-store-screenshots");

type ProductsPayload = {
  products?: Array<{
    id: string;
    slug: string;
    stock?: number;
    isActive?: boolean;
  }>;
};

const scenarios = [
  { name: "01-app-home", path: "/app", heading: /Bienvenue|Welcome|Chez Olive/i },
  { name: "02-shop", path: "/boutique", heading: /Catalogue|Catalog/i },
  { name: "06-orders", path: "/account/orders", heading: /Connecte-toi|Sign in|Commandes|Orders/i },
  { name: "07-support", path: "/faq", heading: /aider|help/i },
] as const;

function nativePath(route: string) {
  const [pathname, query = ""] = route.split("?");
  const params = new URLSearchParams(query);
  params.set("native", "1");
  return `${pathname}?${params.toString()}`;
}

async function captureNative(page: Page, name: string) {
  await expect(page.locator("html")).toHaveClass(/is-capacitor-native/);
  await expect(page.locator(".native-app-global-shell")).toBeVisible();
  await page.screenshot({
    path: path.join(screenshotDir, `${name}.png`),
    fullPage: true,
  });
}

test.describe("Google Play screenshots", () => {
  test.beforeEach(() => {
    fs.mkdirSync(screenshotDir, { recursive: true });
  });

  for (const scenario of scenarios) {
    test(`capture ${scenario.name}`, async ({ page }) => {
      await page.goto(nativePath(scenario.path));
      await expect(page.getByRole("heading", { name: scenario.heading }).first()).toBeVisible();
      await captureNative(page, scenario.name);
    });
  }

  test("capture product, cart and checkout purchase path", async ({ page, request }) => {
    const response = await request.get("/api/products");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as ProductsPayload;
    const product = payload.products?.find((item) => item.isActive !== false && (item.stock ?? 0) > 0);
    expect(product?.id, "an active in-stock product is required for Play screenshots").toBeTruthy();

    await page.goto(nativePath(`/products/${product!.slug}`));
    await expect(page.locator(".olive-product-page h1").first()).toBeVisible();
    await captureNative(page, "03-product");

    await page.addInitScript((productId) => {
      window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId, quantity: 1 }]));
    }, product!.id);

    await page.goto(nativePath("/cart"));
    await expect(page.locator(".cart-item-card")).toHaveCount(1, { timeout: 20_000 });
    await captureNative(page, "04-cart");

    await page.goto(nativePath("/checkout"));
    await expect(page.locator(".checkout-page-header").first()).toBeVisible();
    await captureNative(page, "05-checkout");
  });
});
