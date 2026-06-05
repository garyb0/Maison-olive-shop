import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1366, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const FRAME_TOLERANCE_PX = 2;

type ProductsPayload = {
  products?: Array<{
    slug: string;
    stock?: number;
    isActive?: boolean;
    variants?: Array<{
      stock?: number;
      isActive?: boolean;
    }>;
  }>;
};

type FrameBox = {
  x: number;
  width: number;
  right: number;
};

type FrameMetrics = {
  viewportWidth: number;
  documentWidth: number;
  bodyWidth: number;
  shell: FrameBox;
  header: FrameBox;
  footer: FrameBox;
};

type PublicFrameRoute = {
  label: string;
  path: string;
  visibleSelector: string;
};

function hasAvailableStock(product: NonNullable<ProductsPayload["products"]>[number]) {
  const variantInStock = product.variants?.some((variant) =>
    variant.isActive !== false && (variant.stock ?? 0) > 0,
  );

  return Boolean(variantInStock) || (product.stock ?? 0) > 0;
}

async function getActiveProductSlug(request: APIRequestContext) {
  const response = await request.get("/api/products");
  expect(response.ok(), "products API response").toBe(true);

  const payload = (await response.json()) as ProductsPayload;
  const product = payload.products?.find((item) => item.isActive !== false && hasAvailableStock(item));

  expect(product?.slug, "an active in-stock product is required for visual frame checks").toBeTruthy();

  return product!.slug;
}

function getPublicFrameRoutes(productSlug: string): PublicFrameRoute[] {
  return [
    { label: "home", path: "/?home=1", visibleSelector: ".home-hero" },
    { label: "shop", path: "/boutique", visibleSelector: ".catalog-section" },
    { label: "product", path: `/products/${productSlug}`, visibleSelector: ".olive-product-page" },
    { label: "account", path: "/account", visibleSelector: ".account-access-card, .account-layout-shell" },
    { label: "cart", path: "/cart", visibleSelector: ".cart-page-header, .cart-empty-state" },
    { label: "checkout", path: "/checkout", visibleSelector: ".checkout-page-header, .checkout-section-card, .cart-empty-state" },
    { label: "login", path: "/login", visibleSelector: ".login-auth-frame" },
    { label: "forgot-password", path: "/forgot-password", visibleSelector: ".auth-shell" },
    { label: "reset-password", path: "/reset-password", visibleSelector: ".auth-shell" },
    { label: "faq", path: "/faq", visibleSelector: ".help-hero" },
    { label: "terms", path: "/terms", visibleSelector: ".legal-page" },
    { label: "privacy", path: "/privacy", visibleSelector: ".legal-page" },
    { label: "data-deletion", path: "/data-deletion", visibleSelector: ".legal-page" },
    { label: "checkout-success", path: "/checkout/success", visibleSelector: ".checkout-success-shell" },
  ];
}

async function readDesktopFrameMetrics(page: Page, visibleSelector: string) {
  await expect(page.locator(".nav-marketplace-main").first()).toBeVisible();
  await expect(page.locator(visibleSelector).first()).toBeVisible();
  await expect(page.locator(".site-footer").first()).toBeAttached();
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true));

  return page.evaluate((): FrameMetrics => {
    const readBox = (targetSelector: string) => {
      const element = document.querySelector(targetSelector);
      if (!element) {
        throw new Error(`Missing frame element: ${targetSelector}`);
      }

      const rect = element.getBoundingClientRect();

      return {
        x: rect.x,
        width: rect.width,
        right: rect.right,
      };
    };

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      shell: readBox("body > .app-shell"),
      header: readBox(".nav-marketplace-main"),
      footer: readBox(".site-footer"),
    };
  });
}

async function readMobileFrameMetrics(page: Page, visibleSelector: string) {
  await expect(page.locator(visibleSelector).first()).toBeVisible();
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true));

  return page.evaluate((): Pick<FrameMetrics, "viewportWidth" | "documentWidth" | "bodyWidth" | "shell"> => {
    const shell = document.querySelector("body > .app-shell");
    if (!shell) {
      throw new Error("Missing frame element: body > .app-shell");
    }

    const rect = shell.getBoundingClientRect();

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      shell: {
        x: rect.x,
        width: rect.width,
        right: rect.right,
      },
    };
  });
}

function expectClose(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(FRAME_TOLERANCE_PX);
}

function expectFrameClose(actual: FrameBox, expected: FrameBox, label: string) {
  expectClose(actual.x, expected.x, `${label} x`);
  expectClose(actual.width, expected.width, `${label} width`);
  expectClose(actual.right, expected.right, `${label} right`);
}

function expectNoHorizontalOverflow(
  metrics: Pick<FrameMetrics, "viewportWidth" | "documentWidth" | "bodyWidth">,
  label: string,
) {
  expect(metrics.documentWidth, `${label} document width`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bodyWidth, `${label} body width`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.describe("public visual frame", () => {
  test.describe("desktop", () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test("public customer routes keep the same shell, header and footer frame", async ({ page, request }) => {
      const productSlug = await getActiveProductSlug(request);
      const routes = getPublicFrameRoutes(productSlug);
      const frames: Array<{ label: string; metrics: FrameMetrics }> = [];

      for (const route of routes) {
        await page.goto(route.path);
        await page.waitForLoadState("domcontentloaded");

        const metrics = await readDesktopFrameMetrics(page, route.visibleSelector);
        expectNoHorizontalOverflow(metrics, route.label);
        frames.push({ label: route.label, metrics });
      }

      const baseline = frames[0]!.metrics;

      for (const frame of frames.slice(1)) {
        expectFrameClose(frame.metrics.shell, baseline.shell, `${frame.label} shell follows home`);
        expectFrameClose(frame.metrics.header, baseline.header, `${frame.label} header follows home`);
        expectFrameClose(frame.metrics.footer, baseline.footer, `${frame.label} footer follows home`);
      }
    });
  });

  test.describe("mobile", () => {
    test.use({
      viewport: MOBILE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });

    test("public customer routes do not overflow on mobile", async ({ page, request }) => {
      const productSlug = await getActiveProductSlug(request);
      const routes = getPublicFrameRoutes(productSlug);

      for (const route of routes) {
        await page.goto(route.path);
        await page.waitForLoadState("domcontentloaded");

        const metrics = await readMobileFrameMetrics(page, route.visibleSelector);
        expectNoHorizontalOverflow(metrics, route.label);
        expect(metrics.shell.x, `${route.label} shell starts inside viewport`).toBeGreaterThanOrEqual(-1);
        expect(metrics.shell.right, `${route.label} shell ends inside viewport`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      }
    });
  });
});
