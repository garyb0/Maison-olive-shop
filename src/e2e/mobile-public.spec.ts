import { expect, test, type Locator, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const PUBLIC_ROUTES = [
  { path: "/?home=1", label: "home" },
  { path: "/boutique", label: "boutique" },
  { path: "/faq", label: "faq" },
  { path: "/cart", label: "cart" },
] as const;

type ProductsPayload = {
  products?: Array<{
    id: string;
    slug: string;
    stock?: number;
    isActive?: boolean;
    isSubscription?: boolean;
  }>;
};

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

test.describe("mobile public layout", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.label}: no horizontal overflow and drawer starts fully hidden`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");

      await expectNoHorizontalOverflow(page);

      const drawer = page.locator(".nav-drawer").first();
      await expect(drawer).toBeAttached();
      await expect(drawer).toHaveAttribute("aria-hidden", "true");

      const drawerState = await drawer.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return {
          left: rect.left,
          right: rect.right,
          pointerEvents: style.pointerEvents,
          visibility: style.visibility,
        };
      });

      expect(drawerState.right, "closed drawer must not leave a visible edge").toBeLessThanOrEqual(1);
      expect(drawerState.pointerEvents).toBe("none");
      expect(drawerState.visibility).toBe("hidden");
    });
  }

  test("navigation tap targets are mobile safe", async ({ page }) => {
    await page.goto("/boutique");
    await page.waitForLoadState("domcontentloaded");

    await expectMinTapSize(page.locator(".nav-hamburger").first(), "hamburger");
    await expectMinTapSize(page.locator(".nav-marketplace-search button").first(), "mobile search submit");
    await expectMinTapSize(page.locator(".nav-marketplace-mobile-actions .nav-marketplace-cart").first(), "mobile cart");

    await page.locator(".nav-hamburger").first().click();

    await expect(page.locator(".nav-drawer").first()).toHaveAttribute("aria-hidden", "false");
    await expectMinTapSize(page.locator(".nav-drawer-close").first(), "drawer close");
    await expectMinTapSize(page.locator(".nav-drawer .nav-search-submit").first(), "drawer search submit");
    await expectMinTapSize(page.locator(".nav-drawer-lang").first(), "drawer language");
    await expectMinTapSize(page.locator(".nav-drawer-link").first(), "drawer first link");
  });

  test("promo carousel dots keep 44px touch areas", async ({ page }) => {
    await page.goto("/?home=1");
    await page.waitForLoadState("domcontentloaded");

    const dots = page.locator(".promo-banner-dot");
    const count = await dots.count();

    test.skip(count === 0, "No promo carousel dot is rendered for the current data set.");

    await expectMinTapSize(dots.first(), "promo dot");
  });

  test("home hero, footer and home-to-shop header stay mobile-friendly", async ({ page }) => {
    await page.goto("/?home=1");
    await page.waitForLoadState("domcontentloaded");

    const homeMetrics = await page.evaluate(() => {
      const hero = document.querySelector(".home-hero")?.getBoundingClientRect();
      const primaryCta = document.querySelector(".home-hero-primary")?.getBoundingClientRect();
      const footer = document.querySelector(".site-footer")?.getBoundingClientRect();
      const nav = document.querySelector(".nav-marketplace")?.getBoundingClientRect();

      return {
        viewportHeight: window.innerHeight,
        heroHeight: hero?.height ?? 0,
        primaryCtaBottom: primaryCta?.bottom ?? Number.POSITIVE_INFINITY,
        footerHeight: footer?.height ?? 0,
        navHeight: nav?.height ?? 0,
      };
    });

    expect(homeMetrics.heroHeight, "mobile hero should no longer dominate the page").toBeLessThanOrEqual(720);
    expect(homeMetrics.primaryCtaBottom, "primary CTA should be visible quickly").toBeLessThanOrEqual(homeMetrics.viewportHeight);
    expect(homeMetrics.footerHeight, "mobile footer should be compact").toBeLessThanOrEqual(760);

    await page.screenshot({ path: "test-results/mobile-home-step2.png", fullPage: true });

    await page.locator(".home-hero-primary").click();
    await expect(page).toHaveURL(/\/boutique/);
    await page.waitForLoadState("domcontentloaded");

    const shopNavHeight = await page.locator(".nav-marketplace").first().evaluate((element) => (
      element.getBoundingClientRect().height
    ));

    expect(Math.abs(shopNavHeight - homeMetrics.navHeight), "home and shop mobile header heights should be stable").toBeLessThanOrEqual(1);
    await expectNoHorizontalOverflow(page);
  });

  test("faq mobile keeps anchors and opens the support event", async ({ page }) => {
    await page.goto("/faq");
    await page.waitForLoadState("domcontentloaded");

    await expectNoHorizontalOverflow(page);

    for (const id of ["livraison", "commandes", "paiement", "retours", "compte", "colliers-qr", "conditions"]) {
      await expect(page.locator(`#${id}`), `#${id} section should exist`).toBeAttached();
    }

    const anchorBox = await page.locator(".help-anchor-nav a").first().boundingBox();
    expect(anchorBox, "first FAQ anchor should be measurable").not.toBeNull();
    expect(anchorBox!.height, "FAQ anchor tap height").toBeGreaterThanOrEqual(44);

    await page.evaluate(() => {
      const typedWindow = window as typeof window & { __chezoliveSupportOpenCount?: number };
      typedWindow.__chezoliveSupportOpenCount = 0;
      window.addEventListener("chezolive:support-open", () => {
        typedWindow.__chezoliveSupportOpenCount = (typedWindow.__chezoliveSupportOpenCount ?? 0) + 1;
      });
    });

    await page.locator(".help-support-actions__primary").first().click();
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __chezoliveSupportOpenCount?: number }).__chezoliveSupportOpenCount ?? 0
    ))).toBe(1);

    await page.screenshot({ path: "test-results/mobile-faq-step3.png", fullPage: true });
  });

  test("legacy help routes redirect to the FAQ anchors", async ({ page }) => {
    for (const route of [
      { from: "/shipping", hash: "livraison" },
      { from: "/returns", hash: "retours" },
      { from: "/terms", hash: "conditions" },
    ]) {
      await page.goto(route.from);
      await expect(page).toHaveURL(new RegExp(`/faq#${route.hash}$`));
      await expect(page.locator(`#${route.hash}`)).toBeAttached();
    }
  });

  test("help sitemap stays canonical", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();

    expect(sitemapText).toContain("/faq");
    expect(sitemapText).not.toContain("/shipping");
    expect(sitemapText).not.toContain("/returns");
    expect(sitemapText).not.toContain("/terms");

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
  });

  test("boutique mobile prioritizes available products and keeps add-to-cart clear", async ({ page, request }) => {
    const response = await request.get("/api/products");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as ProductsPayload;
    const products = payload.products ?? [];
    const availableProduct = products.find((product) => product.isActive !== false && (product.stock ?? 0) > 0);
    const unavailableProduct = products.find((product) => product.isActive !== false && (product.stock ?? 0) === 0);

    expect(availableProduct?.slug, "An available product is required for the mobile shop smoke.").toBeTruthy();

    await page.goto("/boutique");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page);

    await expectMinTapSize(page.locator(".catalog-side-link").first(), "catalog category chip");
    await expectMinTapSize(page.locator(".catalog-conversion-strip a").first(), "catalog delivery help link");
    await expectMinTapSize(page.locator(".catalog-product-add").first(), "first product add button");

    const firstCard = page.locator(".catalog-product-card").first();
    await expect(firstCard.locator(".catalog-stock-pill--in, .catalog-stock-pill--low")).toBeVisible();

    const availableCard = page
      .locator(".catalog-product-card")
      .filter({ has: page.locator(`a[href="/products/${availableProduct!.slug}"]`) })
      .first();
    await expect(availableCard).toBeVisible();

    await availableCard.locator(".catalog-product-add").click();
    await expect.poll(() => page.evaluate(() => {
      const raw = window.localStorage.getItem("chezolive_cart_v1");
      if (!raw) return 0;
      try {
        return (JSON.parse(raw) as Array<{ quantity?: number }>).reduce((sum, line) => sum + (line.quantity ?? 0), 0);
      } catch {
        return 0;
      }
    })).toBeGreaterThan(0);
    await expect(page.locator(".nav-marketplace-mobile-actions .nav-cart-count")).toHaveText(/[1-9]/);

    if (unavailableProduct) {
      const unavailableCard = page
        .locator(".catalog-product-card")
        .filter({ has: page.locator(`a[href="/products/${unavailableProduct.slug}"]`) })
        .first();
      await expect(unavailableCard.locator(".catalog-stock-pill--out")).toBeVisible();
      await expect(unavailableCard.locator(".catalog-product-add")).toBeDisabled();
      await expect(unavailableCard.locator(".catalog-product-add")).toContainText(/Indisponible|Unavailable/i);
    }

    await page.screenshot({ path: "test-results/mobile-boutique-step4.png", fullPage: true });
  });

  test("product pages explain available and unavailable purchase states", async ({ page, request }) => {
    const response = await request.get("/api/products");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as ProductsPayload;
    const products = payload.products ?? [];
    const availableProduct = products.find((product) => product.isActive !== false && (product.stock ?? 0) > 0);
    const unavailableProduct = products.find((product) => product.isActive !== false && (product.stock ?? 0) === 0);

    expect(availableProduct?.slug, "An available product is required for the mobile product smoke.").toBeTruthy();

    await page.goto(`/products/${availableProduct!.slug}`);
    await page.waitForLoadState("domcontentloaded");
    await expectNoHorizontalOverflow(page);
    await expectMinTapSize(page.locator(".olive-product-add-btn").first(), "product add button");
    await expectMinTapSize(page.locator(".olive-product-trust-grid a").first(), "product trust link");
    await expect(page.locator(".olive-product-trust-grid")).toContainText(/Livraison locale|Local delivery/i);
    await expect(page.locator(".olive-product-trust-grid")).toContainText(/Paiement sécurisé|Secure payment/i);
    await expect(page.locator(".olive-product-trust-grid")).toContainText(/Retour \/ problème|Return \/ issue/i);
    await page.locator(".olive-product-add-btn").first().click();
    await expect(page.locator(".olive-product-add-btn").first()).toContainText(/Ajout|Added/i);
    await page.screenshot({ path: "test-results/mobile-product-step4.png", fullPage: true });

    if (unavailableProduct) {
      await page.goto(`/products/${unavailableProduct.slug}`);
      await page.waitForLoadState("domcontentloaded");
      await expectNoHorizontalOverflow(page);
      await expect(page.locator(".olive-product-add-btn").first()).toBeDisabled();
      await expect(page.locator(".olive-product-unavailable-note")).toBeVisible();
    }
  });

  test("cart mobile handles empty and seeded item states", async ({ page, request }) => {
    await page.goto("/cart");
    await page.waitForLoadState("domcontentloaded");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText(/Ton panier est vide|Your cart is empty/i)).toBeVisible();

    const response = await request.get("/api/products");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as ProductsPayload;
    const availableProduct = payload.products?.find((product) => product.isActive !== false && (product.stock ?? 0) > 0);
    expect(availableProduct?.id, "An available product is required for the mobile cart smoke.").toBeTruthy();

    await page.evaluate((productId) => {
      window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId, quantity: 2 }]));
    }, availableProduct!.id);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await expectNoHorizontalOverflow(page);
    await expect(page.locator(".cart-item-card")).toHaveCount(1);
    await expectMinTapSize(page.locator(".cart-qty-btn").first(), "cart quantity button");
    await expectMinTapSize(page.locator(".cart-item-card .cart-remove-btn").first(), "cart remove button");
    await expectMinTapSize(page.locator(".cart-checkout-btn").first(), "cart checkout CTA");
    await expect(page.locator(".cart-summary-next-steps")).toContainText(/Adresse locale|Local address/i);
    await expect(page.locator(".cart-summary-next-steps")).toContainText(/Créneau de livraison|Delivery window/i);
    await expect(page.getByText(/Besoin d'aide avant de payer|Need help before paying/i)).toBeVisible();

    await page.screenshot({ path: "test-results/mobile-cart-step5.png", fullPage: true });
  });

  test("checkout mobile with a seeded item has clear steps, final CTA and no support overlap", async ({ page, request }) => {
    const response = await request.get("/api/products");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as ProductsPayload;
    const availableProduct = payload.products?.find((product) => product.isActive !== false && (product.stock ?? 0) > 0);
    expect(availableProduct?.id, "An available product is required for the mobile checkout smoke.").toBeTruthy();

    await page.addInitScript((productId) => {
      window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId, quantity: 1 }]));
    }, availableProduct!.id);

    await page.goto("/checkout");
    await page.waitForLoadState("domcontentloaded");

    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { name: /Finaliser ma commande|Checkout/i })).toBeVisible();
    await expect(page.locator(".checkout-step-card")).toHaveCount(4);
    await expectMinTapSize(page.locator(".checkout-flow-strip span").first(), "checkout step chip");
    await expectMinTapSize(page.locator(".checkout-help-strip a").first(), "checkout help link");
    await expectMinTapSize(page.locator(".checkout-payment-assurance a").first(), "checkout payment help link");
    await expectMinTapSize(page.locator(".checkout-place-order-btn").first(), "checkout final CTA");
    await expect(page.locator(".checkout-payment-assurance")).toContainText(/Stripe sécurise|Stripe secures/i);
    await expect(page.locator(".checkout-final-action-note")).toContainText(/prépare le paiement|prepares card payment/i);

    const supportFloat = page.locator(".support-lite-float").first();
    if (await supportFloat.count()) {
      await expect(supportFloat).toBeHidden();
    }

    await page.screenshot({ path: "test-results/mobile-checkout-step5.png", fullPage: true });
  });

  test("account mobile guards stay readable for signed-out users", async ({ page }) => {
    for (const route of ["/account", "/account/orders", "/account/dogs", "/account/profile", "/account/subscriptions", "/account/support"]) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      await expectNoHorizontalOverflow(page);
      await expect(page.locator(".account-access-card")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Connecte-toi|Sign in/i })).toBeVisible();
      await expectMinTapSize(page.locator(".account-access-actions .btn").first(), "account sign-in CTA");

      const supportFloat = page.locator(".support-lite-float").first();
      if (await supportFloat.count()) {
        await expect(supportFloat).toBeHidden();
      }
    }

    await page.screenshot({ path: "test-results/mobile-account-guard-step6.png", fullPage: true });
  });

  test("login recovery pages remain mobile stable", async ({ page }) => {
    for (const route of ["/login", "/forgot-password"]) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await expectNoHorizontalOverflow(page);
    }

    await expectMinTapSize(page.locator("button[type='submit']").first(), "auth submit");
    await page.screenshot({ path: "test-results/mobile-auth-step6.png", fullPage: true });
  });
});
